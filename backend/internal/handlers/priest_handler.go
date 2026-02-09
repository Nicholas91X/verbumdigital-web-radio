package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/services"
)

type PriestHandler struct {
	PriestService *services.PriestService
}

func NewPriestHandler(priestService *services.PriestService) *PriestHandler {
	return &PriestHandler{PriestService: priestService}
}

// ============================================
// GET /priest/churches
// Returns all churches the priest manages
// ============================================

func (h *PriestHandler) GetChurches(c *gin.Context) {
	priestID := middleware.GetUserID(c)

	churches, err := h.PriestService.GetChurches(priestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch churches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"churches": churches})
}

// ============================================
// GET /priest/churches/:id/stream/status
// Returns streaming status + credentials for ST1
// ============================================

func (h *PriestHandler) GetStreamStatus(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	status, err := h.PriestService.GetStreamStatus(priestID, churchID)
	if err != nil {
		if err.Error() == "church not found or access denied" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stream status"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// ============================================
// POST /priest/churches/:id/stream/start
// Creates session, returns credentials for ST1
//
// Flow:
// 1. Priest PWA calls this endpoint
// 2. Backend creates session, returns stream credentials
// 3. Priest PWA sends play + stream_url to ST1 (local smixRest)
// 4. ST1 validates with backend and starts encoding
// ============================================

func (h *PriestHandler) StartStream(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	session, err := h.PriestService.StartStream(priestID, churchID)
	if err != nil {
		switch err.Error() {
		case "church not found or access denied":
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case "stream is already active":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case "no streaming credentials configured for this church":
			c.JSON(http.StatusPreconditionFailed, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start stream"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stream session created",
		"session": session,
	})
}

// ============================================
// POST /priest/churches/:id/stream/stop
// Ends session, updates church status
//
// Flow:
// 1. Priest PWA sends stop to ST1 (local smixRest)
// 2. Priest PWA calls this endpoint
// 3. Backend ends session, clears streaming_active
// ============================================

func (h *PriestHandler) StopStream(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	session, err := h.PriestService.StopStream(priestID, churchID)
	if err != nil {
		switch err.Error() {
		case "church not found or access denied":
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case "no active stream to stop":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop stream"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stream stopped",
		"session": session,
	})
}

// ============================================
// GET /priest/churches/:id/sessions
// Returns streaming session history
// ============================================

func (h *PriestHandler) GetSessions(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	sessions, err := h.PriestService.GetSessions(priestID, churchID, limit)
	if err != nil {
		if err.Error() == "church not found or access denied" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}
