package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/services"
)

type UserHandler struct {
	UserService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{UserService: userService}
}

// ============================================
// GET /user/churches?search=...
// Browse all churches (with optional search)
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
// GET /user/churches/:id
// Church detail with subscriber count
// ============================================

func (h *UserHandler) GetChurch(c *gin.Context) {
	churchID, err := parseUintParam(c, "id")
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
// POST /user/churches/:id/subscribe
// Subscribe to a church
// ============================================

func (h *UserHandler) Subscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	sub, err := h.UserService.Subscribe(userID, churchID)
	if err != nil {
		switch err.Error() {
		case "church not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "already subscribed":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Subscribed successfully",
		"subscription": sub,
	})
}

// ============================================
// DELETE /user/churches/:id/subscribe
// Unsubscribe from a church
// ============================================

func (h *UserHandler) Unsubscribe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
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
// GET /user/subscriptions
// List all user's subscriptions with church info and live status
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
// PUT /user/churches/:id/notifications
// Toggle notification preference for a subscription
// ============================================

func (h *UserHandler) UpdateNotifications(c *gin.Context) {
	userID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.UserService.UpdateNotificationPreference(userID, churchID, req.Enabled); err != nil {
		if err.Error() == "subscription not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preference"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification preference updated"})
}

// ============================================
// GET /user/stream/:stream_id
// Get the Icecast stream URL (must be subscribed)
// ============================================

func (h *UserHandler) GetStreamURL(c *gin.Context) {
	userID := middleware.GetUserID(c)
	streamID := c.Param("stream_id")

	result, err := h.UserService.GetStreamURL(userID, streamID)
	if err != nil {
		switch err.Error() {
		case "stream not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "not subscribed to this church":
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stream"})
		}
		return
	}

	c.JSON(http.StatusOK, result)
}
