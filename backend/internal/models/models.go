package models

import (
	"time"
)

// ============================================
// MACHINES
// ============================================
type Machine struct {
	ID             int32     `gorm:"primaryKey" json:"id"`
	UID            string    `gorm:"column:machine_id;uniqueIndex;size:50;not null" json:"machine_id"`
	Activated      bool      `gorm:"default:false" json:"activated"`
	ActivationCode string    `gorm:"size:20" json:"activation_code,omitempty"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Has one church
	Church *Church `gorm:"foreignKey:MachineID;references:ID" json:"church,omitempty"`
}

// ============================================
// CHURCHES
// ============================================
type Church struct {
	ID               int32     `gorm:"primaryKey" json:"id"`
	MachineID        *int32    `gorm:"uniqueIndex" json:"machine_id"`
	Name             string    `gorm:"size:200;not null" json:"name"`
	LogoURL          string    `gorm:"size:500" json:"logo_url,omitempty"`
	Address          string    `json:"address,omitempty"`
	StreamingActive  bool      `gorm:"default:false" json:"streaming_active"`
	CurrentSessionID *int32    `json:"current_session_id,omitempty"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Machine             *Machine             `gorm:"foreignKey:MachineID;references:ID" json:"machine,omitempty"`
	CurrentSession      *StreamingSession    `gorm:"foreignKey:CurrentSessionID;references:ID" json:"current_session,omitempty"`
	StreamingCredential *StreamingCredential `gorm:"foreignKey:ChurchID;references:ID" json:"streaming_credential,omitempty"`
	Priests             []Priest             `gorm:"many2many:priest_churches;joinForeignKey:ChurchID;joinReferences:PriestID" json:"priests,omitempty"`
	Sessions            []StreamingSession   `gorm:"foreignKey:ChurchID;references:ID" json:"sessions,omitempty"`
	Subscriptions       []UserSubscription   `gorm:"foreignKey:ChurchID;references:ID" json:"subscriptions,omitempty"`
}

// ============================================
// STREAMING CREDENTIALS
// Identifies a church's Icecast mount point.
// stream_key is no longer used — Icecast global source password
// is pre-configured on ST1 hardware by Svilen.
// ============================================
type StreamingCredential struct {
	ID        int32     `gorm:"primaryKey" json:"id"`
	ChurchID  int32     `gorm:"uniqueIndex;not null" json:"church_id"`
	StreamID  string    `gorm:"uniqueIndex;size:100;not null" json:"stream_id"`
	StreamKey *string   `gorm:"size:255" json:"stream_key,omitempty"` // deprecated, nullable
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Church *Church `gorm:"foreignKey:ChurchID;references:ID" json:"church,omitempty"`
}

// ============================================
// PRIESTS
// ============================================
type Priest struct {
	ID           int32     `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:200;not null" json:"name"`
	Email        string    `gorm:"uniqueIndex;size:200;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Churches []Church `gorm:"many2many:priest_churches;joinForeignKey:PriestID;joinReferences:ChurchID" json:"churches,omitempty"`
}

// ============================================
// PRIEST-CHURCH (join table)
// ============================================
type PriestChurch struct {
	ID        int32     `gorm:"primaryKey" json:"id"`
	PriestID  int32     `gorm:"not null" json:"priest_id"`
	ChurchID  int32     `gorm:"not null" json:"church_id"`
	Role      string    `gorm:"size:20;default:'owner'" json:"role"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	Priest *Priest `gorm:"foreignKey:PriestID" json:"priest,omitempty"`
	Church *Church `gorm:"foreignKey:ChurchID" json:"church,omitempty"`
}

func (PriestChurch) TableName() string {
	return "priest_churches"
}

// ============================================
// USERS (fedeli)
// ============================================
type User struct {
	ID           int32     `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:200;not null" json:"name"`
	Email        string    `gorm:"uniqueIndex;size:200;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Subscriptions []UserSubscription `gorm:"foreignKey:UserID;references:ID" json:"subscriptions,omitempty"`
}

// ============================================
// USER SUBSCRIPTIONS
// ============================================
type UserSubscription struct {
	ID                   int32     `gorm:"primaryKey" json:"id"`
	UserID               int32     `gorm:"not null" json:"user_id"`
	ChurchID             int32     `gorm:"not null" json:"church_id"`
	NotificationsEnabled bool      `gorm:"default:true" json:"notifications_enabled"`
	CreatedAt            time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	User   *User   `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
	Church *Church `gorm:"foreignKey:ChurchID;references:ID" json:"church,omitempty"`
}

func (UserSubscription) TableName() string {
	return "user_subscriptions"
}

// ============================================
// ADMINS
// ============================================
type Admin struct {
	ID           int32     `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:100;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;size:200;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// ============================================
// STREAMING SESSIONS
// ============================================
type StreamingSession struct {
	ID                int32      `gorm:"primaryKey" json:"id"`
	ChurchID          int32      `gorm:"not null" json:"church_id"`
	StartedByPriestID *int32     `json:"started_by_priest_id,omitempty"` // nil when started by ST1 hardware
	StartedAt         time.Time  `gorm:"not null" json:"started_at"`
	EndedAt           *time.Time `json:"ended_at,omitempty"`
	DurationSeconds   *int       `json:"duration_seconds,omitempty"`
	RecordingURL      string     `gorm:"size:500" json:"recording_url,omitempty"`
	MaxListenerCount  int        `gorm:"default:0" json:"max_listener_count"`
	CreatedAt         time.Time  `gorm:"autoCreateTime" json:"created_at"`

	Church *Church `gorm:"foreignKey:ChurchID" json:"church,omitempty"`
	Priest *Priest `gorm:"foreignKey:StartedByPriestID" json:"priest,omitempty"`
}

// ============================================
// ACTIVE LISTENERS
// ============================================
type ActiveListener struct {
	ID            int32     `gorm:"primaryKey" json:"id"`
	SessionID     int32     `gorm:"not null" json:"session_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	ConnectedAt   time.Time `gorm:"autoCreateTime" json:"connected_at"`
	LastHeartbeat time.Time `gorm:"autoCreateTime" json:"last_heartbeat"`

	Session *StreamingSession `gorm:"foreignKey:SessionID" json:"session,omitempty"`
	User    *User             `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// ============================================
// PUSH SUBSCRIPTIONS (Web Push API)
// ============================================
type PushSubscription struct {
	ID        int32     `gorm:"primaryKey" json:"id"`
	UserID    int32     `gorm:"not null;index" json:"user_id"`
	Endpoint  string    `gorm:"size:500;not null;uniqueIndex" json:"endpoint"`
	P256dh    string    `gorm:"size:200;not null" json:"p256dh"`
	Auth      string    `gorm:"size:100;not null" json:"auth"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	User *User `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}
