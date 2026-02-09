package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/services"
)

type AuthHandler struct {
	AuthService *services.AuthService
	JWTSecret   string
	JWTExpHours int
}

func NewAuthHandler(authService *services.AuthService, jwtSecret string, jwtExpHours int) *AuthHandler {
	return &AuthHandler{
		AuthService: authService,
		JWTSecret:   jwtSecret,
		JWTExpHours: jwtExpHours,
	}
}

// ============================================
// REQUEST / RESPONSE TYPES
// ============================================

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}

// ============================================
// ADMIN LOGIN
// ============================================

func (h *AuthHandler) AdminLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	admin, err := h.AuthService.AdminLogin(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := middleware.GenerateToken(admin.ID, admin.Email, middleware.RoleAdmin, h.JWTSecret, h.JWTExpHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User: gin.H{
			"id":       admin.ID,
			"username": admin.Username,
			"email":    admin.Email,
			"role":     middleware.RoleAdmin,
		},
	})
}

// ============================================
// PRIEST LOGIN
// ============================================

func (h *AuthHandler) PriestLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priest, err := h.AuthService.PriestLogin(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := middleware.GenerateToken(priest.ID, priest.Email, middleware.RolePriest, h.JWTSecret, h.JWTExpHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User: gin.H{
			"id":    priest.ID,
			"name":  priest.Name,
			"email": priest.Email,
			"role":  middleware.RolePriest,
		},
	})
}

// ============================================
// USER LOGIN
// ============================================

func (h *AuthHandler) UserLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.AuthService.UserLogin(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email, middleware.RoleUser, h.JWTSecret, h.JWTExpHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User: gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  middleware.RoleUser,
		},
	})
}

// ============================================
// USER REGISTER
// ============================================

func (h *AuthHandler) UserRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.AuthService.UserRegister(req.Name, req.Email, req.Password)
	if err != nil {
		if err.Error() == "email already registered" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email, middleware.RoleUser, h.JWTSecret, h.JWTExpHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User: gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  middleware.RoleUser,
		},
	})
}
