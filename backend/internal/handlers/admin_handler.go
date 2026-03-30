package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/services"
)

type AdminHandler struct {
	AdminService *services.AdminService
}

func NewAdminHandler(adminService *services.AdminService) *AdminHandler {
	return &AdminHandler{AdminService: adminService}
}

// ============================================
// REQUEST / RESPONSE TYPES
// ============================================

type CreateMachineRequest struct {
	MachineID string `json:"machine_id" binding:"required"`
}

type UpdateMachineRequest struct {
	MachineID string `json:"machine_id" binding:"required"`
}

type CreateChurchRequest struct {
	Name      string `json:"name" binding:"required"`
	Address   string `json:"address"`
	LogoURL   string `json:"logo_url"`
	MachineID *int32 `json:"machine_id"`
}

type UpdateChurchRequest struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	LogoURL   string `json:"logo_url"`
	MachineID *int32 `json:"machine_id"`
}

type CreatePriestRequest struct {
	Name      string  `json:"name" binding:"required"`
	Email     string  `json:"email" binding:"required,email"`
	Password  string  `json:"password" binding:"required,min=6"`
	ChurchIDs []int32 `json:"church_ids"`
}

type UpdatePriestRequest struct {
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	Password  string  `json:"password"`
	ChurchIDs []int32 `json:"church_ids"`
}

// ============================================
// MACHINES
// ============================================

func (h *AdminHandler) ListMachines(c *gin.Context) {
	machines, err := h.AdminService.ListMachines()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch machines"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"machines": machines})
}

func (h *AdminHandler) CreateMachine(c *gin.Context) {
	var req CreateMachineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	machine, err := h.AdminService.CreateMachine(req.MachineID)
	if err != nil {
		if err.Error() == "machine_id already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create machine"})
		return
	}

	c.JSON(http.StatusCreated, machine)
}

func (h *AdminHandler) UpdateMachine(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req UpdateMachineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	machine, err := h.AdminService.UpdateMachine(id, req.MachineID)
	if err != nil {
		if err.Error() == "machine not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update machine"})
		return
	}

	c.JSON(http.StatusOK, machine)
}

func (h *AdminHandler) ActivateMachine(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	machine, err := h.AdminService.ActivateMachine(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, machine)
}

func (h *AdminHandler) DeactivateMachine(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	machine, err := h.AdminService.DeactivateMachine(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, machine)
}

// ============================================
// CHURCHES
// ============================================

func (h *AdminHandler) ListChurches(c *gin.Context) {
	churches, err := h.AdminService.ListChurches()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch churches: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"churches": churches})
}

func (h *AdminHandler) CreateChurch(c *gin.Context) {
	var req CreateChurchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	church, cred, err := h.AdminService.CreateChurch(req.Name, req.Address, req.LogoURL, req.MachineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"church":      church,
		"credentials": cred,
	})
}

func (h *AdminHandler) UpdateChurch(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req UpdateChurchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	church, err := h.AdminService.UpdateChurch(id, req.Name, req.Address, req.LogoURL, req.MachineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, church)
}

// ============================================
// PRIESTS
// ============================================

func (h *AdminHandler) ListPriests(c *gin.Context) {
	priests, err := h.AdminService.ListPriests()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch priests"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"priests": priests})
}

func (h *AdminHandler) CreatePriest(c *gin.Context) {
	var req CreatePriestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priest, err := h.AdminService.CreatePriest(req.Name, req.Email, req.Password, req.ChurchIDs)
	if err != nil {
		if err.Error() == "email already registered" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create priest: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, priest)
}

func (h *AdminHandler) DeleteMachine(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.AdminService.DeleteMachine(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *AdminHandler) DeleteChurch(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.AdminService.DeleteChurch(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *AdminHandler) UpdatePriest(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req UpdatePriestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	priest, err := h.AdminService.UpdatePriest(id, req.Name, req.Email, req.Password, req.ChurchIDs)
	if err != nil {
		switch err.Error() {
		case "priest not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "email already registered":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, priest)
}

func (h *AdminHandler) DeletePriest(c *gin.Context) {
	id, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.AdminService.DeletePriest(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// SESSIONS
// ============================================

func (h *AdminHandler) ListSessions(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	sessions, err := h.AdminService.ListSessions(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sessions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// ============================================
// DONATIONS
// ============================================

func (h *AdminHandler) ListDonations(c *gin.Context) {
	churchID, err := parseInt32Param(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	from := c.Query("from")
	to := c.Query("to")

	donations, err := h.AdminService.ListDonations(churchID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch donations"})
		return
	}

	// Calculate basic stats
	var totalAmount int
	for _, d := range donations {
		if d.Status == "completed" {
			totalAmount += d.Amount
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"donations":          donations,
		"total_amount_cents": totalAmount,
	})
}
