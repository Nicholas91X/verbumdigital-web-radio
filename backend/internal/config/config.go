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

	// JWT
	JWTSecret          string
	JWTExpirationHours string

	// ST1 / Icecast
	IcecastBaseURL        string
	IcecastSourcePassword string
	DeviceAPIKey          string
}

func Load() (*Config, error) {
	// Load .env file if it exists (ignored in production)
	godotenv.Load()

	cfg := &Config{
		Port:                  getEnv("PORT", "8081"),
		DBHost:                getEnv("DB_HOST", "localhost"),
		DBPort:                getEnv("DB_PORT", "3306"),
		DBUser:                getEnv("DB_USER", "st1stream"),
		DBPassword:            getEnv("DB_PASSWORD", ""),
		DBName:                getEnv("DB_NAME", "st1stream"),
		JWTSecret:             getEnv("JWT_SECRET", ""),
		JWTExpirationHours:    getEnv("JWT_EXPIRATION_HOURS", "72"),
		IcecastBaseURL:        getEnv("ICECAST_BASE_URL", "http://vdserv.com:8000"),
		IcecastSourcePassword: getEnv("ICECAST_SOURCE_PASSWORD", ""),
		DeviceAPIKey:          getEnv("DEVICE_API_KEY", ""),
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
	if cfg.IcecastSourcePassword == "" {
		return nil, fmt.Errorf("ICECAST_SOURCE_PASSWORD is required")
	}

	return cfg, nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
