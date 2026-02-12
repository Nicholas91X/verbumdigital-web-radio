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
// Returns read-only streaming status (no credentials)
// ============================================

func (h *PriestHandler) GetStreamStatus(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
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
// GET /priest/churches/:id/sessions
// Returns streaming session history
// ============================================

func (h *PriestHandler) GetSessions(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
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
