package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	UploadsDir string
	AppBaseURL string
}

func NewUploadHandler(uploadsDir, appBaseURL string) *UploadHandler {
	return &UploadHandler{
		UploadsDir: uploadsDir,
		AppBaseURL: appBaseURL,
	}
}

// POST /admin/upload/image
// Accepts multipart/form-data with field "image", max 2MB.
// Returns { "url": "https://api.verbumdigital.it/uploads/filename.jpg" }
func (h *UploadHandler) UploadImage(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(2 << 20); err != nil { // 2 MB
		c.JSON(http.StatusBadRequest, gin.H{"error": "File troppo grande (max 2MB)"})
		return
	}

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campo 'image' mancante"})
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	allowed := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
		"image/gif":  ".gif",
		"image/svg+xml": ".svg",
	}
	ext, ok := allowed[contentType]
	if !ok {
		// Fallback: derive from filename
		origExt := strings.ToLower(filepath.Ext(header.Filename))
		extMap := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true, ".svg": true}
		if !extMap[origExt] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Formato non supportato (jpg, png, webp, gif, svg)"})
			return
		}
		ext = origExt
		if ext == ".jpeg" {
			ext = ".jpg"
		}
	}

	// Ensure uploads dir exists
	if err := os.MkdirAll(h.UploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossibile creare directory uploads"})
		return
	}

	// Generate unique filename: timestamp + random hex
	randomBytes := make([]byte, 6)
	rand.Read(randomBytes)
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), hex.EncodeToString(randomBytes), ext)
	destPath := filepath.Join(h.UploadsDir, filename)

	// Read uploaded file content
	buf := make([]byte, 2<<20)
	n, _ := file.Read(buf)

	if err := os.WriteFile(destPath, buf[:n], 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Errore salvataggio file"})
		return
	}

	url := fmt.Sprintf("%s/uploads/%s", h.AppBaseURL, filename)
	c.JSON(http.StatusOK, gin.H{"url": url})
}
