package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/config"
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

	// Verify connection
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Database connected successfully")

	// Setup router
	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API v1 route groups (handlers will be added in next steps)
	v1 := r.Group("/api/v1")
	{
		// Public routes (no auth)
		v1.POST("/auth/admin/login", placeholder("admin login"))
		v1.POST("/auth/priest/login", placeholder("priest login"))
		v1.POST("/auth/user/login", placeholder("user login"))
		v1.POST("/auth/user/register", placeholder("user register"))

		// Admin routes
		admin := v1.Group("/admin")
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

		// Priest routes
		priest := v1.Group("/priest")
		{
			priest.GET("/churches", placeholder("priest's churches"))
			priest.GET("/churches/:id/stream/status", placeholder("stream status"))
			priest.POST("/churches/:id/stream/start", placeholder("start stream"))
			priest.POST("/churches/:id/stream/stop", placeholder("stop stream"))
			priest.GET("/churches/:id/sessions", placeholder("session history"))
		}

		// User routes
		user := v1.Group("/user")
		{
			user.GET("/churches", placeholder("browse churches"))
			user.GET("/churches/:id", placeholder("church detail"))
			user.POST("/churches/:id/subscribe", placeholder("subscribe"))
			user.DELETE("/churches/:id/subscribe", placeholder("unsubscribe"))
			user.GET("/subscriptions", placeholder("my subscriptions"))
			user.GET("/stream/:stream_id", placeholder("get stream URL"))
		}

		// ST1 device-to-server endpoints
		device := v1.Group("/device")
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

// placeholder returns a temporary handler that shows the route is registered
func placeholder(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(501, gin.H{
			"message": fmt.Sprintf("[%s] Not implemented yet", name),
		})
	}
}
