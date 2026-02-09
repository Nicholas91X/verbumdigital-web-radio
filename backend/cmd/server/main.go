package main

import (
	"fmt"
	"log"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/config"
	"github.com/verbumdigital/web-radio/internal/handlers"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/services"
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

	// JWT config
	jwtExpHours, _ := strconv.Atoi(cfg.JWTExpirationHours)
	if jwtExpHours == 0 {
		jwtExpHours = 72
	}

	// =====================
	// SERVICES
	// =====================
	authService := services.NewAuthService(db)
	priestService := services.NewPriestService(db)

	// =====================
	// HANDLERS
	// =====================
	authHandler := handlers.NewAuthHandler(authService, cfg.JWTSecret, jwtExpHours)
	priestHandler := handlers.NewPriestHandler(priestService)
	deviceHandler := handlers.NewDeviceHandler(db)

	// =====================
	// ROUTER
	// =====================
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	auth := middleware.AuthMiddleware(cfg.JWTSecret)

	v1 := r.Group("/api/v1")
	{
		// PUBLIC
		v1.POST("/auth/admin/login", authHandler.AdminLogin)
		v1.POST("/auth/priest/login", authHandler.PriestLogin)
		v1.POST("/auth/user/login", authHandler.UserLogin)
		v1.POST("/auth/user/register", authHandler.UserRegister)

		// ADMIN
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

		// PRIEST
		priest := v1.Group("/priest")
		priest.Use(auth, middleware.RequireRole(middleware.RolePriest))
		{
			priest.GET("/churches", priestHandler.GetChurches)
			priest.GET("/churches/:id/stream/status", priestHandler.GetStreamStatus)
			priest.POST("/churches/:id/stream/start", priestHandler.StartStream)
			priest.POST("/churches/:id/stream/stop", priestHandler.StopStream)
			priest.GET("/churches/:id/sessions", priestHandler.GetSessions)
		}

		// USER
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

		// DEVICE (ST1)
		device := v1.Group("/device")
		device.Use(middleware.DeviceAuth(cfg.DeviceAPIKey))
		{
			device.POST("/validate", deviceHandler.Validate)
			device.POST("/stream/started", deviceHandler.StreamStarted)
			device.POST("/stream/stopped", deviceHandler.StreamStopped)
		}
	}

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
