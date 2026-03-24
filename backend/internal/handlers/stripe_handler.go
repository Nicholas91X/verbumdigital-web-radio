package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/services"
)

type StripeHandler struct {
	StripeService *services.StripeService
}

func NewStripeHandler(stripeService *services.StripeService) *StripeHandler {
	return &StripeHandler{StripeService: stripeService}
}

// POST /admin/churches/:id/stripe/onboard
func (h *StripeHandler) OnboardChurch(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	url, err := h.StripeService.GenerateOnboardingLink(int32(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": url})
}

// GET /admin/churches/:id/stripe/status
func (h *StripeHandler) GetOnboardingStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	complete, err := h.StripeService.CheckOnboardingStatus(int32(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"complete": complete})
}

// GET /stripe/connect/callback
func (h *StripeHandler) ConnectCallback(c *gin.Context) {
	churchIDStr := c.Query("church_id")
	churchID, err := strconv.Atoi(churchIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	err = h.StripeService.HandleConnectCallback(int32(churchID))
	if err != nil {
		// Log error if needed, redirect to admin interface with error
		c.Redirect(http.StatusTemporaryRedirect, "https://admin.verbumdigital.it/churches?stripe_error=true")
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, "https://admin.verbumdigital.it/churches?stripe_success=true")
}
