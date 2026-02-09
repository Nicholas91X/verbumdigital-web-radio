package handlers

import (
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
// REQUEST TYPES
// ============================================

type CreateMachineRequest struct {
	MachineID string `json:"machine_id" binding:"required"`
}

type UpdateMachineRequest struct {
	MachineID string `json:"machine_id"`
}

type CreateChurchRequest struct {
	Name      string `json:"name" binding:"required"`
	Address   string `json:"address"`
	LogoURL   string `json:"logo_url"`
	MachineID *uint  `json:"machine_id"`
}

type UpdateChurchRequest struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	LogoURL   string `json:"logo_url"`
	MachineID *uint  `json:"machine_id"`
}

type CreatePriestRequest struct {
	Name      string `json:"name" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	ChurchIDs []uint `json:"church_ids"`
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

	c.JSON(http.StatusCreated, gin.H{"machine": machine})
}

func (h *AdminHandler) UpdateMachine(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid machine ID"})
		return
	}

	var req UpdateMachineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	machine, err := h.AdminService.UpdateMachine(id, req.MachineID)
	if err != nil {
		switch err.Error() {
		case "machine not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "machine_id already exists":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update machine"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"machine": machine})
}

func (h *AdminHandler) ActivateMachine(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid machine ID"})
		return
	}

	machine, err := h.AdminService.ActivateMachine(id)
	if err != nil {
		switch err.Error() {
		case "machine not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "machine already activated":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate machine"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Machine activated",
		"machine": machine,
	})
}

func (h *AdminHandler) DeactivateMachine(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid machine ID"})
		return
	}

	machine, err := h.AdminService.DeactivateMachine(id)
	if err != nil {
		switch err.Error() {
		case "machine not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "machine already deactivated":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate machine"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Machine deactivated",
		"machine": machine,
	})
}

// ============================================
// CHURCHES
// ============================================

func (h *AdminHandler) ListChurches(c *gin.Context) {
	churches, err := h.AdminService.ListChurches()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch churches"})
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
		switch err.Error() {
		case "machine not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "machine already assigned to another church":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create church"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"church":                church,
		"streaming_credentials": cred,
	})
}

func (h *AdminHandler) UpdateChurch(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid church ID"})
		return
	}

	var req UpdateChurchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	church, err := h.AdminService.UpdateChurch(id, req.Name, req.Address, req.LogoURL, req.MachineID)
	if err != nil {
		switch err.Error() {
		case "church not found":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "machine already assigned to another church":
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update church"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"church": church})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create priest: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"priest": priest})
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
