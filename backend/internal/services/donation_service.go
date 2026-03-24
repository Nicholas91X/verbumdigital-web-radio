package services

import (
	"errors"

	"encoding/json"

	"github.com/stripe/stripe-go/v76"
	session_checkout "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/webhook"
	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type DonationService struct {
	DB            *gorm.DB
	StripeKey     string
	WebhookSecret string
	AppBaseURL    string
}

func NewDonationService(db *gorm.DB, stripeKey, webhookSecret, appBaseURL string) *DonationService {
	return &DonationService{DB: db, StripeKey: stripeKey, WebhookSecret: webhookSecret, AppBaseURL: appBaseURL}
}

func (s *DonationService) isPriestOfChurch(priestID, churchID int32) bool {
	var count int64
	s.DB.Table("priest_churches").Where("priest_id = ? AND church_id = ?", priestID, churchID).Count(&count)
	return count > 0
}

// GET /priest/churches/:id/donation-presets
func (s *DonationService) GetPresets(priestID, churchID int32) ([]models.DonationPreset, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var presets []models.DonationPreset
	if err := s.DB.Where("church_id = ?", churchID).Order("is_default desc, id asc").Find(&presets).Error; err != nil {
		return nil, err
	}
	return presets, nil
}

// POST /priest/churches/:id/donation-presets
func (s *DonationService) CreatePreset(priestID, churchID int32, name string, amounts []int, isDefault bool) (*models.DonationPreset, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if isDefault {
			// Unset other defaults
			tx.Model(&models.DonationPreset{}).Where("church_id = ?", churchID).Update("is_default", false)
		} else {
			// Check if this is the first preset
			var count int64
			tx.Model(&models.DonationPreset{}).Where("church_id = ?", churchID).Count(&count)
			if count == 0 {
				isDefault = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	preset := models.DonationPreset{
		ChurchID:  churchID,
		Name:      name,
		Amounts:   amounts,
		IsDefault: isDefault,
	}

	if err := s.DB.Create(&preset).Error; err != nil {
		return nil, err
	}

	return &preset, nil
}

// PUT /priest/donation-presets/:id
func (s *DonationService) UpdatePreset(priestID, presetID int32, name string, amounts []int, isDefault bool) (*models.DonationPreset, error) {
	var preset models.DonationPreset
	if err := s.DB.First(&preset, presetID).Error; err != nil {
		return nil, errors.New("preset not found")
	}

	if !s.isPriestOfChurch(priestID, preset.ChurchID) {
		return nil, errors.New("access denied")
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if isDefault && !preset.IsDefault {
			tx.Model(&models.DonationPreset{}).Where("church_id = ?", preset.ChurchID).Update("is_default", false)
		}
		
		preset.Name = name
		preset.Amounts = amounts
		preset.IsDefault = isDefault

		return tx.Save(&preset).Error
	})

	return &preset, err
}

// DELETE /priest/donation-presets/:id
func (s *DonationService) DeletePreset(priestID, presetID int32) error {
	var preset models.DonationPreset
	if err := s.DB.First(&preset, presetID).Error; err != nil {
		return errors.New("preset not found")
	}

	if !s.isPriestOfChurch(priestID, preset.ChurchID) {
		return errors.New("access denied")
	}

	return s.DB.Delete(&preset).Error
}

// POST /priest/donation-presets/:id/set-default
func (s *DonationService) SetDefaultPreset(priestID, presetID int32) error {
	var preset models.DonationPreset
	if err := s.DB.First(&preset, presetID).Error; err != nil {
		return errors.New("preset not found")
	}

	if !s.isPriestOfChurch(priestID, preset.ChurchID) {
		return errors.New("access denied")
	}

	return s.DB.Transaction(func(tx *gorm.DB) error {
		tx.Model(&models.DonationPreset{}).Where("church_id = ?", preset.ChurchID).Update("is_default", false)
		preset.IsDefault = true
		return tx.Save(&preset).Error
	})
}

// POST /priest/sessions/:id/donation/open
func (s *DonationService) OpenDonation(priestID, sessionID int32, presetID int32) error {
	var session models.StreamingSession
	if err := s.DB.First(&session, sessionID).Error; err != nil {
		return errors.New("session not found")
	}

	if !s.isPriestOfChurch(priestID, session.ChurchID) {
		return errors.New("access denied")
	}

	if session.EndedAt != nil {
		return errors.New("session already ended")
	}

	// Verify preset belongs to church
	var preset models.DonationPreset
	if err := s.DB.First(&preset, presetID).Error; err != nil {
		return errors.New("preset not found")
	}
	if preset.ChurchID != session.ChurchID {
		return errors.New("preset does not belong to this church")
	}

	session.DonationActive = true
	session.DonationPresetID = &presetID
	return s.DB.Save(&session).Error
}

// POST /priest/sessions/:id/donation/close
func (s *DonationService) CloseDonation(priestID, sessionID int32) error {
	var session models.StreamingSession
	if err := s.DB.First(&session, sessionID).Error; err != nil {
		return errors.New("session not found")
	}

	if !s.isPriestOfChurch(priestID, session.ChurchID) {
		return errors.New("access denied")
	}

	session.DonationActive = false
	return s.DB.Save(&session).Error
}

// GET /sessions/:id/donation/status
func (s *DonationService) GetDonationStatus(sessionID int32) (map[string]interface{}, error) {
	var session models.StreamingSession
	if err := s.DB.First(&session, sessionID).Error; err != nil {
		return nil, errors.New("session not found")
	}

	res := map[string]interface{}{
		"donation_active": session.DonationActive,
	}

	if session.DonationActive && session.DonationPresetID != nil {
		var preset models.DonationPreset
		if err := s.DB.First(&preset, *session.DonationPresetID).Error; err == nil {
			res["preset"] = map[string]interface{}{
				"id":      preset.ID,
				"name":    preset.Name,
				"amounts": preset.Amounts,
			}
		}
	}

	return res, nil
}

// POST /sessions/:id/donation/checkout
func (s *DonationService) CreateCheckoutSession(userID *int32, sessionID int32, amountCents int) (string, error) {
	var session models.StreamingSession
	if err := s.DB.Preload("Church").First(&session, sessionID).Error; err != nil {
		return "", errors.New("session not found")
	}

	if !session.DonationActive {
		return "", errors.New("donations are not active for this session")
	}

	if session.Church.StripeAccountID == nil || *session.Church.StripeAccountID == "" {
		return "", errors.New("church cannot accept donations")
	}

	var userEmail string
	if userID != nil {
		var user models.User
		if err := s.DB.First(&user, *userID).Error; err == nil {
			userEmail = user.Email
		}
	}

	stripe.Key = s.StripeKey
	
	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String("eur"),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String("Donazione - " + session.Church.Name),
					},
					UnitAmount: stripe.Int64(int64(amountCents)),
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL: stripe.String(s.AppBaseURL + "/donation/success"), // Actually should redirect to User PWA, but backend provides URL. Can be adjusted.
		CancelURL:  stripe.String(s.AppBaseURL + "/donation/cancel"),
	}

	// Route the payment to the connected account directly
	params.SetStripeAccount(*session.Church.StripeAccountID)

	if userEmail != "" {
		params.CustomerEmail = stripe.String(userEmail)
	}

	sess, err := session_checkout.New(params)
	if err != nil {
		return "", err
	}

	donation := models.Donation{
		UserID:                  userID,
		ChurchID:                session.ChurchID,
		SessionID:               &session.ID,
		Amount:                  amountCents,
		Currency:                "eur",
		StripeCheckoutSessionID: &sess.ID,
		Status:                  "pending",
	}
	s.DB.Create(&donation)

	return sess.URL, nil
}

// POST /stripe/webhook
func (s *DonationService) HandleWebhookEvent(payload []byte, signature string) error {
	event, err := webhook.ConstructEvent(payload, signature, s.WebhookSecret)
	if err != nil {
		return err
	}

	switch event.Type {
	case "checkout.session.completed":
		var session stripe.CheckoutSession
		err := json.Unmarshal(event.Data.Raw, &session)
		if err != nil {
			return err
		}

		var donation models.Donation
		if err := s.DB.Where("stripe_checkout_session_id = ?", session.ID).First(&donation).Error; err == nil {
			donation.Status = "completed"
			if session.PaymentIntent != nil {
				donation.StripePaymentIntentID = &session.PaymentIntent.ID
			}
			s.DB.Save(&donation)
		}
	}

	return nil
}
