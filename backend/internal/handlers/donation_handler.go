package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/services"
)

type DonationHandler struct {
	DonationService *services.DonationService
}

func NewDonationHandler(donationService *services.DonationService) *DonationHandler {
	return &DonationHandler{DonationService: donationService}
}

type PresetRequest struct {
	Name      string `json:"name" binding:"required"`
	Amounts   []int  `json:"amounts" binding:"required,min=1"`
	IsDefault bool   `json:"is_default"`
}

type OpenDonationRequest struct {
	PresetID int32 `json:"preset_id" binding:"required"`
}

// PRIEST ENDPOINTS

func (h *DonationHandler) GetPresets(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	presets, err := h.DonationService.GetPresets(priestID, churchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"presets": presets})
}

func (h *DonationHandler) CreatePreset(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	var req PresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preset, err := h.DonationService.CreatePreset(priestID, churchID, req.Name, req.Amounts, req.IsDefault)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, preset)
}

func (h *DonationHandler) UpdatePreset(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	presetID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preset ID"})
		return
	}

	var req PresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preset, err := h.DonationService.UpdatePreset(priestID, presetID, req.Name, req.Amounts, req.IsDefault)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preset)
}

func (h *DonationHandler) DeletePreset(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	presetID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preset ID"})
		return
	}

	if err := h.DonationService.DeletePreset(priestID, presetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *DonationHandler) SetDefaultPreset(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	presetID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preset ID"})
		return
	}

	if err := h.DonationService.SetDefaultPreset(priestID, presetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *DonationHandler) OpenDonation(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	sessionID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	var req OpenDonationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DonationService.OpenDonation(priestID, sessionID, req.PresetID); err != nil {
		fmt.Printf("Error opening donation: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *DonationHandler) CloseDonation(c *gin.Context) {
	priestID := middleware.GetUserID(c)
	sessionID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	if err := h.DonationService.CloseDonation(priestID, sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// USER / PUBLIC ENDPOINTS
// ============================================

type CheckoutRequest struct {
	Amount     int    `json:"amount" binding:"required,min=50"`
	SuccessURL string `json:"success_url"`
	CancelURL  string `json:"cancel_url"`
}

func (h *DonationHandler) GetDonationStatus(c *gin.Context) {
	sessionID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	status, err := h.DonationService.GetDonationStatus(sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

func (h *DonationHandler) CreateCheckoutSession(c *gin.Context) {
	sessionID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if optional authenticated user
	var pUserID *int32
	// If the route has Auth middleware (optional), GetUserID will retrieve it. 
	// We'll safely attempt to fetch from context if set.
	if id, exists := c.Get("user_id"); exists {
		if uid, ok := id.(int32); ok && uid > 0 {
			pUserID = &uid
		}
	}

	url, err := h.DonationService.CreateCheckoutSession(pUserID, sessionID, req.Amount, req.SuccessURL, req.CancelURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"checkout_url": url})
}

// GET /user/donations — storico donazioni dell'utente autenticato
func (h *DonationHandler) GetUserDonations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	donations, err := h.DonationService.GetUserDonations(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch donations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"donations": donations})
}

func (h *DonationHandler) HandleWebhook(c *gin.Context) {
	payload, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	sigHeader := c.GetHeader("Stripe-Signature")

	err = h.DonationService.HandleWebhookEvent(payload, sigHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}
