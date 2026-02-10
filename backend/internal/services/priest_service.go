package services

import (
	"errors"
	"time"

	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type PriestService struct {
	DB *gorm.DB
}

func NewPriestService(db *gorm.DB) *PriestService {
	return &PriestService{DB: db}
}

// GetChurches returns all churches managed by the priest
func (s *PriestService) GetChurches(priestID int) ([]models.Church, error) {
	var priest models.Priest
	if err := s.DB.Preload("Churches").First(&priest, priestID).Error; err != nil {
		return nil, err
	}
	return priest.Churches, nil
}

// GetStreamStatus returns current streaming status and credentials
func (s *PriestService) GetStreamStatus(priestID, churchID int) (map[string]interface{}, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var church models.Church
	if err := s.DB.Preload("StreamingCredential").First(&church, churchID).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"streaming_active": church.StreamingActive,
		"church_id":        church.ID,
		"credentials":      church.StreamingCredential,
	}, nil
}

// StartStream initializes a new streaming session
func (s *PriestService) StartStream(priestID, churchID int) (*models.StreamingSession, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var church models.Church
	if err := s.DB.Preload("StreamingCredential").First(&church, churchID).Error; err != nil {
		return nil, err
	}

	if church.StreamingActive {
		return nil, errors.New("stream is already active")
	}

	if church.StreamingCredential == nil {
		return nil, errors.New("no streaming credentials configured for this church")
	}

	session := &models.StreamingSession{
		ChurchID:          churchID,
		StartedByPriestID: &priestID,
		StartedAt:         time.Now(),
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(session).Error; err != nil {
			return err
		}

		if err := tx.Model(&church).Updates(map[string]interface{}{
			"streaming_active":   true,
			"current_session_id": session.ID,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return session, nil
}

// StopStream ends an active streaming session
func (s *PriestService) StopStream(priestID, churchID int) (*models.StreamingSession, error) {
	if !s.isPriestOfChurch(priestID, churchID) {
		return nil, errors.New("church not found or access denied")
	}

	var church models.Church
	if err := s.DB.First(&church, churchID).Error; err != nil {
		return nil, err
	}

	if !church.StreamingActive || church.CurrentSessionID == nil {
		return nil, errors.New("no active stream to stop")
	}

	var session models.StreamingSession
	if err := s.DB.First(&session, *church.CurrentSessionID).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	durationSecs := int(now.Sub(session.StartedAt).Seconds())

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&session).Updates(map[string]interface{}{
			"ended_at":         now,
			"duration_seconds": durationSecs,
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(&church).Updates(map[string]interface{}{
			"streaming_active":   false,
			"current_session_id": nil,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &session, nil
}

// GetSessions returns session history for a church
func (s *PriestService) GetSessions(priestID, churchID int, limit int) ([]models.StreamingSession, error) {
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
func (s *PriestService) isPriestOfChurch(priestID, churchID int) bool {
	var count int64
	s.DB.Table("priest_churches").Where("priest_id = ? AND church_id = ?", priestID, churchID).Count(&count)
	return count > 0
}
