package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Roles
const (
	RoleAdmin  = "admin"
	RolePriest = "priest"
	RoleUser   = "user"
	RoleDevice = "device"
)

// JWT claims
type Claims struct {
	UserID int32  `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// AuthMiddleware validates JWT and sets claims in context
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format. Use: Bearer <token>"})
			return
		}

		tokenString := parts[1]

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Set claims in context for handlers
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("claims", claims)

		c.Next()
	}
}

// RequireRole restricts access to specific roles
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "No role found in token"})
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid role in token"})
			return
		}

		for _, allowed := range roles {
			if roleStr == allowed {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
	}
}

// OptionalAuthMiddleware parses JWT if present but does not abort if missing.
// Sets user_id/email/role in context only when a valid token is provided.
func OptionalAuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err == nil && token.Valid {
			c.Set("user_id", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("role", claims.Role)
			c.Set("claims", claims)
		}
		c.Next()
	}
}

// DeviceAuth validates ST1 device requests via API key
// Simpler than JWT since devices don't have user sessions
func DeviceAuth(apiKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Device-Key")
		if key == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing device key"})
			return
		}

		if key != apiKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid device key"})
			return
		}

		c.Set("role", RoleDevice)
		c.Next()
	}
}

// GenerateToken creates a JWT for a given user/role
func GenerateToken(userID int32, email string, role string, jwtSecret string, expirationHours int) (string, error) {
	now := time.Now()

	claims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(expirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// Helper: extract user ID from context
func GetUserID(c *gin.Context) int32 {
	id, _ := c.Get("user_id")
	if id == nil {
		return 0
	}
	// Depending on how it was set, it might be int or int32
	if val, ok := id.(int32); ok {
		return val
	}
	if val, ok := id.(int); ok {
		return int32(val)
	}
	return 0
}

// Helper: extract role from context
func GetRole(c *gin.Context) string {
	role, _ := c.Get("role")
	return role.(string)
}
