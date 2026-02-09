package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type DeviceHandler struct {
	DB *gorm.DB
}

func NewDeviceHandler(db *gorm.DB) *DeviceHandler {
	return &DeviceHandler{DB: db}
}

// ============================================
// REQUEST TYPES
// ============================================

type ValidateRequest struct {
	StreamID  string `json:"stream_id" binding:"required"`
	StreamKey string `json:"stream_key" binding:"required"`
}

type StreamNotifyRequest struct {
	StreamID string `json:"stream_id" binding:"required"`
}

// ============================================
// POST /device/validate
// ST1 calls this to verify stream credentials before starting
// ============================================

func (h *DeviceHandler) Validate(c *gin.Context) {
	var req ValidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cred models.StreamingCredential
	err := h.DB.Where("stream_id = ? AND stream_key = ?", req.StreamID, req.StreamKey).First(&cred).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"valid":   false,
			"message": "Invalid stream credentials",
		})
		return
	}

	// Check if the church's machine is activated
	var church models.Church
	h.DB.Preload("Machine").First(&church, cred.ChurchID)

	if church.Machine == nil || !church.Machine.Activated {
		c.JSON(http.StatusForbidden, gin.H{
			"valid":   false,
			"message": "Machine not activated",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":     true,
		"church_id": cred.ChurchID,
		"stream_id": cred.StreamID,
	})
}

// ============================================
// POST /device/stream/started
// ST1 calls this after successfully starting the stream
// Updates DB flags if not already set by priest handler
// ============================================

func (h *DeviceHandler) StreamStarted(c *gin.Context) {
	var req StreamNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the church by stream_id
	var cred models.StreamingCredential
	if err := h.DB.Where("stream_id = ?", req.StreamID).First(&cred).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// Ensure streaming_active is true (should already be set by priest handler)
	h.DB.Model(&models.Church{}).
		Where("id = ?", cred.ChurchID).
		Update("streaming_active", true)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"church_id": cred.ChurchID,
	})
}

// ============================================
// POST /device/stream/stopped
// ST1 calls this when stream ends (e.g. connection lost, manual stop)
// Acts as a safety net to ensure DB is consistent
// ============================================

func (h *DeviceHandler) StreamStopped(c *gin.Context) {
	var req StreamNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cred models.StreamingCredential
	if err := h.DB.Where("stream_id = ?", req.StreamID).First(&cred).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// Get the church and close any open session
	var church models.Church
	if err := h.DB.First(&church, cred.ChurchID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Church not found"})
		return
	}

	h.DB.Transaction(func(tx *gorm.DB) error {
		// Close open session if exists
		if church.CurrentSessionID != nil {
			now := tx.NowFunc()
			var session models.StreamingSession
			if err := tx.First(&session, *church.CurrentSessionID).Error; err == nil {
				if session.EndedAt == nil {
					durationSecs := int(now.Sub(session.StartedAt).Seconds())
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

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"church_id": cred.ChurchID,
	})
}
