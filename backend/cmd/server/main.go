package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Verbum Digital Web Radio API on port %s", port)

	// TODO: Initialize database connection
	// TODO: Setup routes
	// TODO: Start server
}
