package services

import (
	"errors"
	"fmt"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/account"
	"github.com/stripe/stripe-go/v76/accountlink"
	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type StripeService struct {
	DB         *gorm.DB
	StripeKey  string
	AppBaseURL string
}

func NewStripeService(db *gorm.DB, stripeKey string, appBaseURL string) *StripeService {
	stripe.Key = stripeKey
	return &StripeService{DB: db, StripeKey: stripeKey, AppBaseURL: appBaseURL}
}

// GenerateOnboardingLink creates a Stripe Express account for the church (if it doesn't have one)
// and returns an onboarding URL.
func (s *StripeService) GenerateOnboardingLink(churchID int32) (string, error) {
	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		return "", errors.New("church not found")
	}

	// Create Stripe account if it doesn't exist
	if church.StripeAccountID == nil || *church.StripeAccountID == "" {
		params := &stripe.AccountParams{
			Type: stripe.String(string(stripe.AccountTypeExpress)),
			Capabilities: &stripe.AccountCapabilitiesParams{
				CardPayments: &stripe.AccountCapabilitiesCardPaymentsParams{
					Requested: stripe.Bool(true),
				},
				Transfers: &stripe.AccountCapabilitiesTransfersParams{
					Requested: stripe.Bool(true),
				},
			},
			BusinessType: stripe.String(string(stripe.AccountBusinessTypeNonProfit)),
		}
		
		acct, err := account.New(params)
		if err != nil {
			return "", err
		}

		// Save account ID to church
		church.StripeAccountID = &acct.ID
		if err := s.DB.Save(&church).Error; err != nil {
			return "", err
		}
	}

	// Create Account Link
	refreshURL := fmt.Sprintf("%s/api/v1/stripe/connect/callback?church_id=%d&refresh=true", s.AppBaseURL, churchID)
	returnURL := fmt.Sprintf("%s/api/v1/stripe/connect/callback?church_id=%d&return=true", s.AppBaseURL, churchID)

	linkParams := &stripe.AccountLinkParams{
		Account:    stripe.String(*church.StripeAccountID),
		RefreshURL: stripe.String(refreshURL),
		ReturnURL:  stripe.String(returnURL),
		Type:       stripe.String("account_onboarding"),
	}

	accLink, err := accountlink.New(linkParams)
	if err != nil {
		return "", err
	}

	return accLink.URL, nil
}

func (s *StripeService) CheckOnboardingStatus(churchID int32) (bool, error) {
	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		return false, errors.New("church not found")
	}
	return church.StripeOnboardingComplete, nil
}

func (s *StripeService) HandleConnectCallback(churchID int32) error {
	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		return errors.New("church not found")
	}

	if church.StripeAccountID == nil || *church.StripeAccountID == "" {
		return errors.New("church has no stripe account")
	}

	// Verify account details with Stripe
	acct, err := account.GetByID(*church.StripeAccountID, nil)
	if err != nil {
		return err
	}

	if acct.DetailsSubmitted {
		church.StripeOnboardingComplete = true
		if err := s.DB.Save(&church).Error; err != nil {
			return err
		}
	}

	return nil
}
