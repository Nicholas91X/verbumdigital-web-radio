package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// JWT
	JWTSecret          string
	JWTExpirationHours string

	// ST1 / Icecast
	IcecastBaseURL string
	DeviceAPIKey   string
}

func Load() (*Config, error) {
	// Load .env file if it exists (ignored in production)
	godotenv.Load()

	cfg := &Config{
		Port:               getEnv("PORT", "8081"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "st1stream"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBName:             getEnv("DB_NAME", "st1stream"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		JWTExpirationHours: getEnv("JWT_EXPIRATION_HOURS", "72"),
		IcecastBaseURL:     getEnv("ICECAST_BASE_URL", "http://vdserv.com:8000"),
		DeviceAPIKey:       getEnv("DEVICE_API_KEY", ""),
	}

	if cfg.DBPassword == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.DeviceAPIKey == "" {
		return nil, fmt.Errorf("DEVICE_API_KEY is required")
	}

	return cfg, nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
