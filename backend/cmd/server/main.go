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

	// Disable FK constraints during migration (int32 ↔ bigint unsigned mismatch)
	db.DisableForeignKeyConstraintWhenMigrating = true

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
		&models.DonationPreset{},
		&models.Donation{},
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
	stripeService := services.NewStripeService(db, cfg.StripeSecretKey, cfg.AppBaseURL)
	donationService := services.NewDonationService(db, cfg.StripeSecretKey, cfg.StripeWebhookSecret, cfg.AppBaseURL)

	// =====================
	// HANDLERS
	// =====================
	authHandler := handlers.NewAuthHandler(authService, cfg.JWTSecret, jwtExpHours)
	priestHandler := handlers.NewPriestHandler(priestService)
	userHandler := handlers.NewUserHandler(userService, notificationService)
	adminHandler := handlers.NewAdminHandler(adminService)
	deviceHandler := handlers.NewDeviceHandler(db, cfg.IcecastBaseURL, notificationService)
	stripeHandler := handlers.NewStripeHandler(stripeService)
	donationHandler := handlers.NewDonationHandler(donationService)

	// =====================
	// ROUTER
	// =====================
	r := gin.Default()

	// CORS — allow PWA origins (dev + production)
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			// Development
			"http://localhost:3000", // Admin PWA (dev)
			"http://localhost:3001", // Priest PWA (dev)
			"http://localhost:3002", // User PWA (dev)
			// Production (Vercel → custom domains)
			"https://app.verbumdigital.it",
			"https://admin.verbumdigital.it",
			"https://priest.verbumdigital.it",
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

		// DONATIONS AND STRIPE (public / optionally authenticated)
		v1.GET("/stripe/connect/callback", stripeHandler.ConnectCallback)
		v1.POST("/stripe/webhook", donationHandler.HandleWebhook)
		v1.GET("/sessions/:id/donation/status", donationHandler.GetDonationStatus)
		v1.POST("/sessions/:id/donation/checkout", donationHandler.CreateCheckoutSession)

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

			// STRIPE ONBOARDING & DONATIONS
			admin.POST("/churches/:id/stripe/onboard", stripeHandler.OnboardChurch)
			admin.GET("/churches/:id/stripe/status", stripeHandler.GetOnboardingStatus)
			admin.GET("/churches/:id/donations", adminHandler.ListDonations)
		}

		// PRIEST (read-only — stream control moved to ST1 hardware)
		priest := v1.Group("/priest")
		priest.Use(auth, middleware.RequireRole(middleware.RolePriest))
		{
			priest.GET("/churches", priestHandler.GetChurches)
			priest.GET("/churches/:id/stream/status", priestHandler.GetStreamStatus)
			priest.GET("/churches/:id/sessions", priestHandler.GetSessions)

			// DONATIONS
			priest.GET("/churches/:id/donation-presets", donationHandler.GetPresets)
			priest.POST("/churches/:id/donation-presets", donationHandler.CreatePreset)
			priest.PUT("/donation-presets/:id", donationHandler.UpdatePreset)
			priest.DELETE("/donation-presets/:id", donationHandler.DeletePreset)
			priest.POST("/donation-presets/:id/set-default", donationHandler.SetDefaultPreset)
			priest.POST("/sessions/:id/donation/open", donationHandler.OpenDonation)
			priest.POST("/sessions/:id/donation/close", donationHandler.CloseDonation)
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
			device.POST("/heartbeat", deviceHandler.Heartbeat)
		}
	}

	// =====================
	// HEARTBEAT WATCHDOG
	// Checks every minute for active sessions with no heartbeat in the last 2 minutes.
	// Closes stale sessions automatically (handles ST1 crashes / internet loss).
	// Only acts on sessions that have received at least one heartbeat — sessions
	// without any heartbeat (e.g. old firmware) are left untouched.
	// =====================
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			threshold := time.Now().Add(-2 * time.Minute)

			var churches []models.Church
			db.Where("streaming_active = ? AND current_session_id IS NOT NULL", true).Find(&churches)

			for _, church := range churches {
				var session models.StreamingSession
				if err := db.First(&session, *church.CurrentSessionID).Error; err != nil {
					continue
				}

				// Only close if heartbeat was received at least once and is now stale
				if session.LastHeartbeat == nil || !session.LastHeartbeat.Before(threshold) {
					continue
				}

				now := time.Now()
				durationSecs := int(now.Sub(session.StartedAt).Seconds())
				db.Model(&session).Updates(map[string]interface{}{
					"ended_at":         now,
					"duration_seconds": durationSecs,
					"donation_active":  false,
				})
				db.Model(&models.Church{}).Where("id = ?", church.ID).Updates(map[string]interface{}{
					"streaming_active":   false,
					"current_session_id": nil,
				})
				log.Printf("[Watchdog] Closed stale session %d for church %s (last heartbeat: %s)",
					session.ID, church.Name, session.LastHeartbeat.Format(time.RFC3339))
			}
		}
	}()

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
