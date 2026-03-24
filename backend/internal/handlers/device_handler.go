package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/models"
	"github.com/verbumdigital/web-radio/internal/services"
	"gorm.io/gorm"
)

type DeviceHandler struct {
	DB                  *gorm.DB
	IcecastBaseURL      string
	NotificationService *services.NotificationService
}

func NewDeviceHandler(db *gorm.DB, icecastBaseURL string, notificationService *services.NotificationService) *DeviceHandler {
	return &DeviceHandler{
		DB:                  db,
		IcecastBaseURL:      icecastBaseURL,
		NotificationService: notificationService,
	}
}

// ============================================
// REQUEST TYPES
// ============================================

// ValidateRequest — ST1 identifies itself by serial number on boot
type ValidateRequest struct {
	SerialNumber string `json:"serial_number" binding:"required"`
}

// StreamNotifyRequest — ST1 notifies stream start/stop by serial number
type StreamNotifyRequest struct {
	SerialNumber string `json:"serial_number" binding:"required"`
}

// ============================================
// POST /device/validate
// ST1 calls this on boot to identify itself and receive Icecast config.
// Looks up: serial_number → machine → church → streaming_credentials
// Returns: stream_id, icecast_url, mount point
// ============================================

func (h *DeviceHandler) Validate(c *gin.Context) {
	var req ValidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find machine by serial number (machine_id column)
	var machine models.Machine
	if err := h.DB.Where("machine_id = ?", req.SerialNumber).First(&machine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"valid":   false,
			"message": "Machine not found",
		})
		return
	}

	if !machine.Activated {
		c.JSON(http.StatusForbidden, gin.H{
			"valid":   false,
			"message": "Machine not activated",
		})
		return
	}

	// Find church linked to this machine
	var church models.Church
	if err := h.DB.Preload("StreamingCredential").Where("machine_id = ?", machine.ID).First(&church).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"valid":   false,
			"message": "No church linked to this machine",
		})
		return
	}

	if church.StreamingCredential == nil {
		c.JSON(http.StatusPreconditionFailed, gin.H{
			"valid":   false,
			"message": "No streaming credentials configured for this church",
		})
		return
	}

	// Return Icecast config for ST1 to store
	c.JSON(http.StatusOK, gin.H{
		"valid":       true,
		"church_id":   church.ID,
		"stream_id":   church.StreamingCredential.StreamID,
		"icecast_url": h.IcecastBaseURL,
		"mount":       "/" + church.StreamingCredential.StreamID + ".mp3",
	})
}

// ============================================
// POST /device/stream/started
// ST1 calls this after successfully connecting to Icecast.
// Creates a new streaming session and sets church as live.
// This is the PRIMARY session creation endpoint (not priest).
// ============================================

func (h *DeviceHandler) StreamStarted(c *gin.Context) {
	var req StreamNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Resolve serial_number → machine → church
	church, err := h.resolveChurch(req.SerialNumber)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If already streaming, return idempotent success
	if church.StreamingActive && church.CurrentSessionID != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"church_id":  church.ID,
			"session_id": *church.CurrentSessionID,
			"message":    "Stream already active",
		})
		return
	}

	// Create session in a transaction
	var session models.StreamingSession
	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		session = models.StreamingSession{
			ChurchID:  church.ID,
			StartedAt: time.Now(),
			// StartedByPriestID is nil — started by hardware
		}

		if err := tx.Create(&session).Error; err != nil {
			return err
		}

		return tx.Model(&models.Church{}).Where("id = ?", church.ID).Updates(map[string]interface{}{
			"streaming_active":   true,
			"current_session_id": session.ID,
		}).Error
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Trigger push notifications asynchoronously
	if h.NotificationService != nil {
		go h.NotificationService.NotifyChurchLive(church.ID, church.Name)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"church_id":  church.ID,
		"session_id": session.ID,
	})
}

// ============================================
// POST /device/stream/stopped
// ST1 calls this when stream ends (manual stop, connection lost, etc).
// Closes the current session and resets church status.
// ============================================

func (h *DeviceHandler) StreamStopped(c *gin.Context) {
	var req StreamNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	church, err := h.resolveChurch(req.SerialNumber)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// If not streaming, return idempotent success
	if !church.StreamingActive && church.CurrentSessionID == nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"church_id": church.ID,
			"message":   "No active stream",
		})
		return
	}

	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		// Close open session if exists
		if church.CurrentSessionID != nil {
			now := time.Now()
			var session models.StreamingSession
			if err := tx.First(&session, *church.CurrentSessionID).Error; err == nil {
				if session.EndedAt == nil {
					durationSecs := int32(now.Sub(session.StartedAt).Seconds())
					tx.Model(&session).Updates(map[string]interface{}{
						"ended_at":         now,
						"duration_seconds": durationSecs,
					})
				}
			}
		}

		// Reset church status
		return tx.Model(&models.Church{}).Where("id = ?", church.ID).Updates(map[string]interface{}{
			"streaming_active":   false,
			"current_session_id": nil,
		}).Error
	})

	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to close session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"church_id": church.ID,
	})
}

// ============================================
// POST /device/heartbeat
// ST1 calls this every 30s while streaming.
// Updates last_heartbeat on the active session.
// If the backend stops receiving heartbeats for 2+ minutes,
// the watchdog goroutine in main.go will auto-close the session.
// ============================================

func (h *DeviceHandler) Heartbeat(c *gin.Context) {
	var req StreamNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	church, err := h.resolveChurch(req.SerialNumber)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if !church.StreamingActive || church.CurrentSessionID == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "No active stream"})
		return
	}

	now := time.Now()
	h.DB.Model(&models.StreamingSession{}).
		Where("id = ?", *church.CurrentSessionID).
		Update("last_heartbeat", now)

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// HELPERS
// ============================================

// resolveChurch looks up serial_number → machine → church
func (h *DeviceHandler) resolveChurch(serialNumber string) (*models.Church, error) {
	var machine models.Machine
	if err := h.DB.Where("machine_id = ?", serialNumber).First(&machine).Error; err != nil {
		return nil, err
	}

	var church models.Church
	if err := h.DB.Where("machine_id = ?", machine.ID).First(&church).Error; err != nil {
		return nil, err
	}

	return &church, nil
}
