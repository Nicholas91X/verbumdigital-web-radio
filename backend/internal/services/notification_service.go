package services

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/verbumdigital/web-radio/internal/models"
	"gorm.io/gorm"
)

type NotificationService struct {
	DB              *gorm.DB
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDEmail      string
}

func NewNotificationService(db *gorm.DB, pubKey, privKey, email string) *NotificationService {
	return &NotificationService{
		DB:              db,
		VAPIDPublicKey:  pubKey,
		VAPIDPrivateKey: privKey,
		VAPIDEmail:      email,
	}
}

// SaveSubscription saves or updates a push subscription
func (s *NotificationService) SaveSubscription(userID int, endpoint, p256dh, auth string) error {
	var sub models.PushSubscription
	err := s.DB.Where("endpoint = ?", endpoint).First(&sub).Error

	if err == nil {
		// Update existing
		sub.UserID = userID
		sub.P256dh = p256dh
		sub.Auth = auth
		return s.DB.Save(&sub).Error
	}

	// Create new
	sub = models.PushSubscription{
		UserID:   userID,
		Endpoint: endpoint,
		P256dh:   p256dh,
		Auth:     auth,
	}
	return s.DB.Create(&sub).Error
}

// RemoveSubscription removes a push subscription
func (s *NotificationService) RemoveSubscriptionByEndpoint(endpoint string) error {
	return s.DB.Where("endpoint = ?", endpoint).Delete(&models.PushSubscription{}).Error
}

// NotifyChurchLive sends a push notification to all users subscribed to a church
func (s *NotificationService) NotifyChurchLive(churchID int, churchName string) {
	// 1. Find all users subscribed to this church with notifications enabled
	var userIDs []int
	s.DB.Model(&models.UserSubscription{}).
		Where("church_id = ? AND notifications_enabled = ?", churchID, true).
		Pluck("user_id", &userIDs)

	if len(userIDs) == 0 {
		return
	}

	// 2. Find all push subscriptions for these users
	var subscriptions []models.PushSubscription
	s.DB.Where("user_id IN ?", userIDs).Find(&subscriptions)

	if len(subscriptions) == 0 {
		return
	}

	// 3. Prepare notification payload
	payload, _ := json.Marshal(map[string]interface{}{
		"title":     "Chiesa in diretta!",
		"body":      fmt.Sprintf("%s è ora in onda. Ascolta la trasmissione.", churchName),
		"church_id": churchID,
		"type":      "live_start",
		"icon":      "/pwa-192x192.svg",
	})

	// 4. Send notifications concurrently
	for _, sub := range subscriptions {
		go s.sendPush(sub, payload)
	}
}

func (s *NotificationService) sendPush(sub models.PushSubscription, payload []byte) {
	// Decode keys and endpoint
	s_sub := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256dh,
			Auth:   sub.Auth,
		},
	}

	// Send
	resp, err := webpush.SendNotification(payload, s_sub, &webpush.Options{
		Subscriber:      s.VAPIDEmail,
		VAPIDPublicKey:  s.VAPIDPublicKey,
		VAPIDPrivateKey: s.VAPIDPrivateKey,
		TTL:             3600, // 1 hour
	})

	if err != nil {
		log.Printf("[Push] Error sending to %s: %v", sub.Endpoint, err)
		return
	}
	defer resp.Body.Close()

	// If 410 Gone or 404 Not Found, removing the subscription
	if resp.StatusCode == 410 || resp.StatusCode == 404 {
		log.Printf("[Push] Subscription expired or removed (status %d), deleting endpoint: %s", resp.StatusCode, sub.Endpoint)
		s.RemoveSubscriptionByEndpoint(sub.Endpoint)
	}
}
