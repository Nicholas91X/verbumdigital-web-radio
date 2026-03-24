package services

import (
	"errors"

	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type PriestService struct {
	DB *gorm.DB
}

func NewPriestService(db *gorm.DB) *PriestService {
	return &PriestService{DB: db}
}

func (s *PriestService) GetChurches(priestID int32) ([]models.Church, error) {
	var priest models.Priest
	if err := s.DB.
		Preload("Churches").
		Preload("Churches.Machine").
		First(&priest, priestID).Error; err != nil {
		return nil, err
	}
	return priest.Churches, nil
}

// GetStreamStatus returns read-only streaming status for a church.
// No credentials are exposed — ST1 handles Icecast config directly.
func (s *PriestService) GetStreamStatus(priestID, churchID int32) (map[string]interface{}, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var church models.Church
	if err := s.DB.
		Preload("CurrentSession").
		First(&church, churchID).Error; err != nil {
		return nil, err
	}

	res := map[string]interface{}{
		"church_id":        church.ID,
		"church_name":      church.Name,
		"streaming_active": church.StreamingActive,
	}

	if church.CurrentSession != nil {
		res["session"] = map[string]interface{}{
			"id":                 church.CurrentSession.ID,
			"started_at":         church.CurrentSession.StartedAt,
			"donation_active":    church.CurrentSession.DonationActive,
			"donation_preset_id": church.CurrentSession.DonationPresetID,
		}
	}

	return res, nil
}

// GetSessions returns session history for a church
func (s *PriestService) GetSessions(priestID, churchID int32, limit int) ([]models.StreamingSession, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var sessions []models.StreamingSession
	if err := s.DB.Where("church_id = ?", churchID).Order("started_at desc").Limit(limit).Find(&sessions).Error; err != nil {
		return nil, err
	}

	return sessions, nil
}

// isPriestOfChurch checks if a priest has access to a church
func (s *PriestService) isPriestOfChurch(priestID, churchID int32) bool {
	var count int64
	s.DB.Table("priest_churches").Where("priest_id = ? AND church_id = ?", priestID, churchID).Count(&count)
	return count > 0
}
