package main

import (
	"fmt"
	"log"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/config"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying DB: %v", err)
	}
	defer sqlDB.Close()

	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Database connected successfully")

	// Parse JWT expiration
	jwtExpHours, _ := strconv.Atoi(cfg.JWTExpirationHours)
	if jwtExpHours == 0 {
		jwtExpHours = 72
	}
	// Store for later injection into handlers
	_ = jwtExpHours
	_ = db

	// Setup router
	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Auth middleware instance
	auth := middleware.AuthMiddleware(cfg.JWTSecret)

	v1 := r.Group("/api/v1")
	{
		// =====================
		// PUBLIC (no auth)
		// =====================
		v1.POST("/auth/admin/login", placeholder("admin login"))
		v1.POST("/auth/priest/login", placeholder("priest login"))
		v1.POST("/auth/user/login", placeholder("user login"))
		v1.POST("/auth/user/register", placeholder("user register"))

		// =====================
		// ADMIN (JWT + role check)
		// =====================
		admin := v1.Group("/admin")
		admin.Use(auth, middleware.RequireRole(middleware.RoleAdmin))
		{
			admin.GET("/machines", placeholder("list machines"))
			admin.POST("/machines", placeholder("create machine"))
			admin.PUT("/machines/:id", placeholder("update machine"))
			admin.PUT("/machines/:id/activate", placeholder("activate machine"))
			admin.PUT("/machines/:id/deactivate", placeholder("deactivate machine"))

			admin.GET("/churches", placeholder("list churches"))
			admin.POST("/churches", placeholder("create church"))
			admin.PUT("/churches/:id", placeholder("update church"))

			admin.GET("/priests", placeholder("list priests"))
			admin.POST("/priests", placeholder("create priest"))

			admin.GET("/sessions", placeholder("list sessions"))
		}

		// =====================
		// PRIEST (JWT + role check)
		// =====================
		priest := v1.Group("/priest")
		priest.Use(auth, middleware.RequireRole(middleware.RolePriest))
		{
			priest.GET("/churches", placeholder("priest's churches"))
			priest.GET("/churches/:id/stream/status", placeholder("stream status"))
			priest.POST("/churches/:id/stream/start", placeholder("start stream"))
			priest.POST("/churches/:id/stream/stop", placeholder("stop stream"))
			priest.GET("/churches/:id/sessions", placeholder("session history"))
		}

		// =====================
		// USER (JWT + role check)
		// =====================
		user := v1.Group("/user")
		user.Use(auth, middleware.RequireRole(middleware.RoleUser))
		{
			user.GET("/churches", placeholder("browse churches"))
			user.GET("/churches/:id", placeholder("church detail"))
			user.POST("/churches/:id/subscribe", placeholder("subscribe"))
			user.DELETE("/churches/:id/subscribe", placeholder("unsubscribe"))
			user.GET("/subscriptions", placeholder("my subscriptions"))
			user.GET("/stream/:stream_id", placeholder("get stream URL"))
		}

		// =====================
		// DEVICE - ST1 (API key auth)
		// =====================
		device := v1.Group("/device")
		device.Use(middleware.DeviceAuth(cfg.DeviceAPIKey))
		{
			device.POST("/validate", placeholder("validate stream credentials"))
			device.POST("/stream/started", placeholder("notify stream started"))
			device.POST("/stream/stopped", placeholder("notify stream stopped"))
		}
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func placeholder(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(501, gin.H{
			"message": fmt.Sprintf("[%s] Not implemented yet", name),
		})
	}
}
