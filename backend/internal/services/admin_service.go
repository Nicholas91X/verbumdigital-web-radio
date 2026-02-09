package services

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"

	"github.com/verbumdigital/web-radio/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminService struct {
	DB *gorm.DB
}

func NewAdminService(db *gorm.DB) *AdminService {
	return &AdminService{DB: db}
}

// ============================================
// MACHINES
// ============================================

func (s *AdminService) ListMachines() ([]models.Machine, error) {
	var machines []models.Machine
	err := s.DB.Preload("Church").Order("created_at DESC").Find(&machines).Error
	return machines, err
}

func (s *AdminService) CreateMachine(machineID string) (*models.Machine, error) {
	// Check uniqueness
	var count int64
	s.DB.Model(&models.Machine{}).Where("machine_id = ?", machineID).Count(&count)
	if count > 0 {
		return nil, errors.New("machine_id already exists")
	}

	code, err := generateActivationCode(8)
	if err != nil {
		return nil, err
	}

	machine := &models.Machine{
		MachineID:      machineID,
		Activated:      false,
		ActivationCode: code,
	}

	if err := s.DB.Create(machine).Error; err != nil {
		return nil, err
	}

	return machine, nil
}

func (s *AdminService) UpdateMachine(id uint, machineID string) (*models.Machine, error) {
	var machine models.Machine
	if err := s.DB.First(&machine, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("machine not found")
		}
		return nil, err
	}

	if machineID != "" && machineID != machine.MachineID {
		var count int64
		s.DB.Model(&models.Machine{}).Where("machine_id = ? AND id != ?", machineID, id).Count(&count)
		if count > 0 {
			return nil, errors.New("machine_id already exists")
		}
		machine.MachineID = machineID
	}

	if err := s.DB.Save(&machine).Error; err != nil {
		return nil, err
	}

	return &machine, nil
}

func (s *AdminService) ActivateMachine(id uint) (*models.Machine, error) {
	var machine models.Machine
	if err := s.DB.First(&machine, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("machine not found")
		}
		return nil, err
	}

	if machine.Activated {
		return nil, errors.New("machine already activated")
	}

	machine.Activated = true
	if err := s.DB.Save(&machine).Error; err != nil {
		return nil, err
	}

	return &machine, nil
}

func (s *AdminService) DeactivateMachine(id uint) (*models.Machine, error) {
	var machine models.Machine
	if err := s.DB.First(&machine, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("machine not found")
		}
		return nil, err
	}

	if !machine.Activated {
		return nil, errors.New("machine already deactivated")
	}

	machine.Activated = false
	if err := s.DB.Save(&machine).Error; err != nil {
		return nil, err
	}

	return &machine, nil
}

// ============================================
// CHURCHES
// ============================================

func (s *AdminService) ListChurches() ([]models.Church, error) {
	var churches []models.Church
	err := s.DB.
		Preload("Machine").
		Preload("StreamingCredential").
		Preload("Priests").
		Order("created_at DESC").
		Find(&churches).Error
	return churches, err
}

func (s *AdminService) CreateChurch(name, address, logoURL string, machineID *uint) (*models.Church, *models.StreamingCredential, error) {
	var church models.Church
	var cred models.StreamingCredential

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		// Validate machine if provided
		if machineID != nil {
			var machine models.Machine
			if err := tx.First(&machine, *machineID).Error; err != nil {
				return errors.New("machine not found")
			}
			// Check machine not already assigned
			var count int64
			tx.Model(&models.Church{}).Where("machine_id = ?", *machineID).Count(&count)
			if count > 0 {
				return errors.New("machine already assigned to another church")
			}
		}

		church = models.Church{
			Name:      name,
			Address:   address,
			LogoURL:   logoURL,
			MachineID: machineID,
		}

		if err := tx.Create(&church).Error; err != nil {
			return err
		}

		// Auto-generate streaming credentials
		streamID, err := generateStreamID()
		if err != nil {
			return err
		}
		streamKey, err := generateStreamKey()
		if err != nil {
			return err
		}

		cred = models.StreamingCredential{
			ChurchID:  church.ID,
			StreamID:  streamID,
			StreamKey: streamKey,
		}

		return tx.Create(&cred).Error
	})

	if err != nil {
		return nil, nil, err
	}

	return &church, &cred, nil
}

func (s *AdminService) UpdateChurch(id uint, name, address, logoURL string, machineID *uint) (*models.Church, error) {
	var church models.Church
	if err := s.DB.First(&church, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("church not found")
		}
		return nil, err
	}

	if name != "" {
		church.Name = name
	}
	if address != "" {
		church.Address = address
	}
	if logoURL != "" {
		church.LogoURL = logoURL
	}
	if machineID != nil {
		// Validate machine exists and not assigned elsewhere
		var count int64
		s.DB.Model(&models.Church{}).Where("machine_id = ? AND id != ?", *machineID, id).Count(&count)
		if count > 0 {
			return nil, errors.New("machine already assigned to another church")
		}
		church.MachineID = machineID
	}

	if err := s.DB.Save(&church).Error; err != nil {
		return nil, err
	}

	// Reload with relations
	s.DB.Preload("Machine").Preload("StreamingCredential").First(&church, id)
	return &church, nil
}

// ============================================
// PRIESTS
// ============================================

func (s *AdminService) ListPriests() ([]models.Priest, error) {
	var priests []models.Priest
	err := s.DB.Preload("Churches").Order("created_at DESC").Find(&priests).Error
	return priests, err
}

func (s *AdminService) CreatePriest(name, email, password string, churchIDs []uint) (*models.Priest, error) {
	// Check email uniqueness
	var count int64
	s.DB.Model(&models.Priest{}).Where("email = ?", email).Count(&count)
	if count > 0 {
		return nil, errors.New("email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var priest models.Priest
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		priest = models.Priest{
			Name:         name,
			Email:        email,
			PasswordHash: string(hash),
		}

		if err := tx.Create(&priest).Error; err != nil {
			return err
		}

		// Assign churches
		for _, churchID := range churchIDs {
			var church models.Church
			if err := tx.First(&church, churchID).Error; err != nil {
				return fmt.Errorf("church %d not found", churchID)
			}

			pc := models.PriestChurch{
				PriestID: priest.ID,
				ChurchID: churchID,
				Role:     "owner",
			}
			if err := tx.Create(&pc).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Reload with churches
	s.DB.Preload("Churches").First(&priest, priest.ID)
	return &priest, nil
}

// ============================================
// SESSIONS (read-only overview)
// ============================================

func (s *AdminService) ListSessions(limit int) ([]models.StreamingSession, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var sessions []models.StreamingSession
	err := s.DB.
		Preload("Church").
		Preload("Priest").
		Order("started_at DESC").
		Limit(limit).
		Find(&sessions).Error

	return sessions, err
}

// ============================================
// HELPERS
// ============================================

func generateActivationCode(length int) (string, error) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0, O, 1, I to avoid confusion
	code := make([]byte, length)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	return string(code), nil
}

func generateStreamID() (string, error) {
	code := make([]byte, 12)
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	return "stream" + string(code), nil
}

func generateStreamKey() (string, error) {
	code := make([]byte, 32)
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	return string(code), nil
}
