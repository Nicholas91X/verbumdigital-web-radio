package services

import (
	"errors"
	"fmt"

	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type UserService struct {
	DB             *gorm.DB
	IcecastBaseURL string
}

func NewUserService(db *gorm.DB, icecastBaseURL string) *UserService {
	return &UserService{DB: db, IcecastBaseURL: icecastBaseURL}
}

// GetChurches returns all churches with active streaming info
func (s *UserService) GetChurches(search string) ([]map[string]interface{}, error) {
	var churches []models.Church

	query := s.DB.Select("id, name, logo_url, address, streaming_active")
	if search != "" {
		query = query.Where("LOWER(name) LIKE LOWER(?)", "%"+search+"%")
	}

	if err := query.Order("name ASC").Find(&churches).Error; err != nil {
		return nil, err
	}

	// Return only public-facing data
	result := make([]map[string]interface{}, len(churches))
	for i, ch := range churches {
		result[i] = map[string]interface{}{
			"id":               ch.ID,
			"name":             ch.Name,
			"logo_url":         ch.LogoURL,
			"address":          ch.Address,
			"streaming_active": ch.StreamingActive,
		}
	}

	return result, nil
}

// GetChurch returns a single church with public details
func (s *UserService) GetChurch(churchID int) (map[string]interface{}, error) {
	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("church not found")
		}
		return nil, err
	}

	// Count subscribers
	var subscriberCount int64
	s.DB.Model(&models.UserSubscription{}).Where("church_id = ?", churchID).Count(&subscriberCount)

	return map[string]interface{}{
		"id":               church.ID,
		"name":             church.Name,
		"logo_url":         church.LogoURL,
		"address":          church.Address,
		"streaming_active": church.StreamingActive,
		"subscriber_count": subscriberCount,
	}, nil
}

// Subscribe adds a user subscription to a church
func (s *UserService) Subscribe(userID, churchID int) (*models.UserSubscription, error) {
	// Verify church exists
	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("church not found")
		}
		return nil, err
	}

	// Check if already subscribed
	var existing models.UserSubscription
	err := s.DB.Where("user_id = ? AND church_id = ?", userID, churchID).First(&existing).Error
	if err == nil {
		return &existing, errors.New("already subscribed")
	}

	sub := &models.UserSubscription{
		UserID:               userID,
		ChurchID:             churchID,
		NotificationsEnabled: true,
	}

	if err := s.DB.Create(sub).Error; err != nil {
		return nil, err
	}

	return sub, nil
}

// Unsubscribe removes a user subscription
func (s *UserService) Unsubscribe(userID, churchID int) error {
	result := s.DB.Where("user_id = ? AND church_id = ?", userID, churchID).Delete(&models.UserSubscription{})
	if result.RowsAffected == 0 {
		return errors.New("subscription not found")
	}
	return result.Error
}

// GetSubscriptions returns all churches a user is subscribed to
func (s *UserService) GetSubscriptions(userID int) ([]map[string]interface{}, error) {
	var subs []models.UserSubscription

	err := s.DB.
		Where("user_id = ?", userID).
		Preload("Church").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, len(subs))
	for i, sub := range subs {
		entry := map[string]interface{}{
			"subscription_id":       sub.ID,
			"church_id":             sub.ChurchID,
			"notifications_enabled": sub.NotificationsEnabled,
			"subscribed_at":         sub.CreatedAt,
		}
		if sub.Church != nil {
			entry["church_name"] = sub.Church.Name
			entry["church_logo_url"] = sub.Church.LogoURL
			entry["streaming_active"] = sub.Church.StreamingActive
		}
		result[i] = entry
	}

	return result, nil
}

// UpdateNotificationPreference toggles notifications for a subscription
func (s *UserService) UpdateNotificationPreference(userID, churchID int, enabled bool) error {
	result := s.DB.Model(&models.UserSubscription{}).
		Where("user_id = ? AND church_id = ?", userID, churchID).
		Update("notifications_enabled", enabled)

	if result.RowsAffected == 0 {
		return errors.New("subscription not found")
	}
	return result.Error
}

// GetStreamURL returns the Icecast stream URL for a given stream_id
// User must be subscribed to the church (or we allow open access - TBD)
func (s *UserService) GetStreamURL(userID int, streamID string) (map[string]interface{}, error) {
	// Find credentials by stream_id
	var cred models.StreamingCredential
	if err := s.DB.Where("stream_id = ?", streamID).First(&cred).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("stream not found")
		}
		return nil, err
	}

	// Get church info
	var church models.Church
	if err := s.DB.First(&church, cred.ChurchID).Error; err != nil {
		return nil, err
	}

	// Check subscription (optional - remove this block if streams should be open)
	var subCount int64
	s.DB.Model(&models.UserSubscription{}).
		Where("user_id = ? AND church_id = ?", userID, cred.ChurchID).
		Count(&subCount)
	if subCount == 0 {
		return nil, errors.New("not subscribed to this church")
	}

	// Build Icecast URL: http://vdserv.com:8000/{stream_id}.mp3
	streamURL := fmt.Sprintf("%s/%s.mp3", s.IcecastBaseURL, cred.StreamID)

	return map[string]interface{}{
		"church_id":        church.ID,
		"church_name":      church.Name,
		"streaming_active": church.StreamingActive,
		"stream_url":       streamURL,
	}, nil
}

// GetChurchStream returns the stream info for a specific church
func (s *UserService) GetChurchStream(userID, churchID int) (map[string]interface{}, error) {
	var church models.Church
	if err := s.DB.Preload("StreamingCredential").First(&church, churchID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("church not found")
		}
		return nil, err
	}

	// Check subscription
	var subCount int64
	s.DB.Model(&models.UserSubscription{}).
		Where("user_id = ? AND church_id = ?", userID, churchID).
		Count(&subCount)
	if subCount == 0 {
		return nil, errors.New("not subscribed to this church")
	}

	streamURL := ""
	if church.StreamingCredential != nil {
		streamURL = fmt.Sprintf("%s/%s.mp3", s.IcecastBaseURL, church.StreamingCredential.StreamID)
	}

	return map[string]interface{}{
		"church_id":        church.ID,
		"church_name":      church.Name,
		"streaming_active": church.StreamingActive,
		"stream_url":       streamURL,
	}, nil
}
