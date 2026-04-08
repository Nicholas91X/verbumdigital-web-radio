package services

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type IcecastPoller struct {
	DB      *gorm.DB
	BaseURL string
	Client  *http.Client
}

func NewIcecastPoller(db *gorm.DB, baseURL string) *IcecastPoller {
	if baseURL == "" {
		baseURL = "http://vdserv.com:8000"
	}
	// Make sure baseURL does not end with a slash for consistent path joining
	baseURL = strings.TrimRight(baseURL, "/")

	return &IcecastPoller{
		DB:      db,
		BaseURL: baseURL,
		Client:  &http.Client{Timeout: 10 * time.Second},
	}
}

type IcecastStatusResponse struct {
	Icestats struct {
		Source interface{} `json:"source"`
	} `json:"icestats"`
}

type IcecastSource struct {
	ListenURL  string `json:"listenurl"`
	Listeners  int    `json:"listeners"`
	ServerName string `json:"server_name"`
}

func (p *IcecastPoller) Start(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[IcecastPoller] Shutting down...")
			return
		case <-ticker.C:
			p.poll()
		}
	}
}

func (p *IcecastPoller) poll() {
	url := p.BaseURL + "/status-json.xsl"
	resp, err := p.Client.Get(url)
	if err != nil {
		log.Printf("[IcecastPoller] Error fetching icecast stats: %v", err)
		return
	}
	defer resp.Body.Close()

	var status IcecastStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		log.Printf("[IcecastPoller] Error decoding icecast stats: %v", err)
		return
	}

	var sources []IcecastSource

	// Handle both object and array representations
	switch v := status.Icestats.Source.(type) {
	case []interface{}:
		for _, item := range v {
			if srcMap, ok := item.(map[string]interface{}); ok {
				src := p.parseSource(srcMap)
				sources = append(sources, src)
			}
		}
	case map[string]interface{}:
		src := p.parseSource(v)
		sources = append(sources, src)
	}

	for _, src := range sources {
		if src.ListenURL == "" {
			continue
		}

		// Extract streamID from ListenURL
		// E.g. "http://vdserv.com:8000/stream_123.mp3" -> "stream_123"
		parts := strings.Split(src.ListenURL, "/")
		if len(parts) == 0 {
			continue
		}
		mountPoint := parts[len(parts)-1]
		streamID := strings.TrimSuffix(mountPoint, ".mp3")

		p.updateMaxListeners(streamID, src.Listeners)
	}
}

func (p *IcecastPoller) parseSource(srcMap map[string]interface{}) IcecastSource {
	src := IcecastSource{}

	if val, ok := srcMap["listenurl"].(string); ok {
		src.ListenURL = val
	}
	if val, ok := srcMap["server_name"].(string); ok {
		src.ServerName = val
	}
	
	// 'listeners' can be sometimes parsed as float64 due to JSON unmarshalling from interface{}
	switch v := srcMap["listeners"].(type) {
	case float64:
		src.Listeners = int(v)
	case int:
		src.Listeners = v
	}

	return src
}

func (p *IcecastPoller) updateMaxListeners(streamID string, currentListeners int) {
	// Find credential
	var cred models.StreamingCredential
	if err := p.DB.Where("stream_id = ?", streamID).First(&cred).Error; err != nil {
		return
	}

	// Find active church for this stream
	var church models.Church
	if err := p.DB.Where("id = ? AND streaming_active = ? AND current_session_id IS NOT NULL", cred.ChurchID, true).First(&church).Error; err != nil {
		return
	}

	// Double check and update max_listener_count if this poller found a higher value
	var session models.StreamingSession
	if err := p.DB.Where("id = ?", *church.CurrentSessionID).First(&session).Error; err != nil {
		return
	}

	if int64(currentListeners) > int64(session.MaxListenerCount) {
		p.DB.Model(&session).Update("max_listener_count", int64(currentListeners))
	}
}
