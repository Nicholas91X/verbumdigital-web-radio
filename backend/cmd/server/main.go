package main

import (
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/verbumdigital/web-radio/internal/config"
	"github.com/verbumdigital/web-radio/internal/handlers"
	"github.com/verbumdigital/web-radio/internal/middleware"
	"github.com/verbumdigital/web-radio/internal/models"
	"github.com/verbumdigital/web-radio/internal/services"
	"gorm.io/driver/mysql"
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
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
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

	// AutoMigrate models
	err = db.AutoMigrate(
		&models.Machine{},
		&models.Church{},
		&models.StreamingCredential{},
		&models.Priest{},
		&models.PriestChurch{},
		&models.User{},
		&models.UserSubscription{},
		&models.Admin{},
		&models.StreamingSession{},
		&models.ActiveListener{},
		&models.PushSubscription{},
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}
	log.Println("Database migrated successfully")

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
	userService := services.NewUserService(db, cfg.IcecastBaseURL)
	adminService := services.NewAdminService(db)
	notificationService := services.NewNotificationService(db, cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey, cfg.VAPIDEmail)

	// =====================
	// HANDLERS
	// =====================
	authHandler := handlers.NewAuthHandler(authService, cfg.JWTSecret, jwtExpHours)
	priestHandler := handlers.NewPriestHandler(priestService)
	userHandler := handlers.NewUserHandler(userService, notificationService)
	adminHandler := handlers.NewAdminHandler(adminService)
	deviceHandler := handlers.NewDeviceHandler(db, cfg.IcecastBaseURL, notificationService)

	// =====================
	// ROUTER
	// =====================
	r := gin.Default()

	// CORS — allow PWA origins (dev + production)
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:3000", // Admin PWA (dev)
			"http://localhost:3001", // Priest PWA (dev)
			"http://localhost:3002", // User PWA (dev)
			// Production domains — add here when ready:
			// "https://admin.verbumdigital.com",
			// "https://priest.verbumdigital.com",
			// "https://app.verbumdigital.com",
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Device-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

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
			admin.GET("/machines", adminHandler.ListMachines)
			admin.POST("/machines", adminHandler.CreateMachine)
			admin.PUT("/machines/:id", adminHandler.UpdateMachine)
			admin.PUT("/machines/:id/activate", adminHandler.ActivateMachine)
			admin.PUT("/machines/:id/deactivate", adminHandler.DeactivateMachine)
			admin.GET("/churches", adminHandler.ListChurches)
			admin.POST("/churches", adminHandler.CreateChurch)
			admin.PUT("/churches/:id", adminHandler.UpdateChurch)
			admin.GET("/priests", adminHandler.ListPriests)
			admin.POST("/priests", adminHandler.CreatePriest)
			admin.GET("/sessions", adminHandler.ListSessions)
		}

		// PRIEST (read-only — stream control moved to ST1 hardware)
		priest := v1.Group("/priest")
		priest.Use(auth, middleware.RequireRole(middleware.RolePriest))
		{
			priest.GET("/churches", priestHandler.GetChurches)
			priest.GET("/churches/:id/stream/status", priestHandler.GetStreamStatus)
			priest.GET("/churches/:id/sessions", priestHandler.GetSessions)
		}

		// USER
		user := v1.Group("/user")
		user.Use(auth, middleware.RequireRole(middleware.RoleUser))
		{
			user.GET("/churches", userHandler.GetChurches)
			user.GET("/churches/:id", userHandler.GetChurch)
			user.POST("/churches/:id/subscribe", userHandler.Subscribe)
			user.DELETE("/churches/:id/subscribe", userHandler.Unsubscribe)
			user.GET("/churches/:id/stream", userHandler.GetChurchStream)
			user.PUT("/churches/:id/notifications", userHandler.UpdateNotifications)
			user.GET("/subscriptions", userHandler.GetSubscriptions)
			user.GET("/stream/:stream_id", userHandler.GetStreamURL)

			// PUSH NOTIFICATIONS
			user.POST("/push/subscribe", userHandler.PushSubscribe)
			user.DELETE("/push/unsubscribe", userHandler.PushUnsubscribe)
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
