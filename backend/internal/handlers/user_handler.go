package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/models"
	"github.com/verbumdigital/web-radio/internal/services"
	"gorm.io/gorm"
)

type UserHandler struct {
	UserService         *services.UserService
	NotificationService *services.NotificationService
	DB                  *gorm.DB
}

func NewUserHandler(userService *services.UserService, notificationService *services.NotificationService, db *gorm.DB) *UserHandler {
	return &UserHandler{
		UserService:         userService,
		NotificationService: notificationService,
		DB:                  db,
	}
}

// ============================================
// GET /churches
// Returns all churches
// ============================================

func (h *UserHandler) GetChurches(c *gin.Context) {
	search := c.Query("search")
	churches, err := h.UserService.GetChurches(search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch churches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"churches": churches})
}

// ============================================
// GET /churches/:id
// Returns a single church
// ============================================

func (h *UserHandler) GetChurch(c *gin.Context) {
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	church, err := h.UserService.GetChurch(churchID)
	if err != nil {
		if err.Error() == "church not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch church"})
		return
	}

	c.JSON(http.StatusOK, church)
}

// ============================================
// POST /churches/:id/subscribe
// ============================================

func (h *UserHandler) Subscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	sub, err := h.UserService.Subscribe(userID, churchID)
	if err != nil {
		if err.Error() == "already subscribed" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Subscribed successfully",
		"subscription": sub,
	})
}

// ============================================
// POST /churches/:id/unsubscribe
// ============================================

func (h *UserHandler) Unsubscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	if err := h.UserService.Unsubscribe(userID, churchID); err != nil {
		if err.Error() == "subscription not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unsubscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Unsubscribed successfully"})
}

// ============================================
// GET /subscriptions
// Returns all user subscriptions
// ============================================

func (h *UserHandler) GetSubscriptions(c *gin.Context) {
	userID := middleware.GetUserID(c)

	subs, err := h.UserService.GetSubscriptions(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscriptions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subscriptions": subs})
}

// ============================================
// PATCH /subscriptions/:id/notifications
// ============================================

type NotificationUpdate struct {
	Enabled bool `json:"enabled"`
}

func (h *UserHandler) UpdateNotifications(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	var req NotificationUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.UserService.UpdateNotificationPreference(userID, churchID, req.Enabled); err != nil {
		if err.Error() == "subscription not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification preference updated"})
}

// ============================================
// GET /stream/:stream_id
// ============================================

func (h *UserHandler) GetStreamURL(c *gin.Context) {
	userID := middleware.GetUserID(c)
	streamID := c.Param("stream_id")

	stream, err := h.UserService.GetStreamURL(userID, streamID)
	if err != nil {
		if err.Error() == "stream not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "not subscribed to this church" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stream info"})
		return
	}

	c.JSON(http.StatusOK, stream)
}

// ============================================
// GET /churches/:id/stream
// ============================================

func (h *UserHandler) GetChurchStream(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	stream, err := h.UserService.GetChurchStream(userID, churchID)
	if err != nil {
		if err.Error() == "church not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "not subscribed to this church" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stream info"})
		return
	}

	c.JSON(http.StatusOK, stream)
}

// ============================================
// POST /push/subscribe
// ============================================

type PushSubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	P256dh   string `json:"p256dh" binding:"required"`
	Auth     string `json:"auth" binding:"required"`
}

func (h *UserHandler) PushSubscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req PushSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.NotificationService.SaveSubscription(userID, req.Endpoint, req.P256dh, req.Auth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save push subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Push subscription saved"})
}

// ============================================
// DELETE /push/unsubscribe
// ============================================

type PushUnsubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
}

func (h *UserHandler) PushUnsubscribe(c *gin.Context) {
	var req PushUnsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.NotificationService.RemoveSubscriptionByEndpoint(req.Endpoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove push subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Push subscription removed"})
}

// ============================================
// POST /listener/heartbeat
// Called every 30s while user is listening.
// Creates or updates an ActiveListener record.
// ============================================

type ListenerHeartbeatRequest struct {
	SessionID int32 `json:"session_id" binding:"required"`
}

func (h *UserHandler) ListenerHeartbeat(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req ListenerHeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	var listener models.ActiveListener
	err := h.DB.Where("session_id = ? AND user_id = ?", req.SessionID, userID).First(&listener).Error

	if err != nil {
		// Create new
		listener = models.ActiveListener{
			SessionID:     req.SessionID,
			UserID:        &userID,
			ConnectedAt:   now,
			LastHeartbeat: now,
		}
		h.DB.Create(&listener)
	} else {
		// Update heartbeat
		h.DB.Model(&listener).Update("last_heartbeat", now)
	}

	// Update max_listener_count on the session
	var count int64
	h.DB.Model(&models.ActiveListener{}).Where("session_id = ?", req.SessionID).Count(&count)
	h.DB.Model(&models.StreamingSession{}).Where("id = ? AND max_listener_count < ?", req.SessionID, count).
		Update("max_listener_count", count)

	c.JSON(http.StatusOK, gin.H{"success": true, "listener_count": count})
}

// ============================================
// DELETE /listener/disconnect
// Called when user leaves the listen page.
// ============================================

func (h *UserHandler) ListenerDisconnect(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req ListenerHeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Keep the record (for metrics) but mark final heartbeat
	h.DB.Model(&models.ActiveListener{}).
		Where("session_id = ? AND user_id = ?", req.SessionID, userID).
		Update("last_heartbeat", time.Now())

	c.JSON(http.StatusOK, gin.H{"success": true})
}
