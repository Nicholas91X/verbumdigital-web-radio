-- Migration: 002_st1_architecture.sql
-- VerbumDigital — ST1-driven architecture + Push Notifications

-- ============================================
-- 1. ST1 Architecture Changes
-- ============================================

-- stream_key no longer used (Icecast global password is pre-configured on ST1)
ALTER TABLE streaming_credentials
MODIFY COLUMN stream_key VARCHAR(255) NULL;

-- Ensure started_by_priest_id is nullable (sessions started by ST1 have no priest)
-- Already nullable in 001, but explicit for clarity
ALTER TABLE streaming_sessions
MODIFY COLUMN started_by_priest_id INT NULL;

-- ============================================
-- 2. Push Notifications (Web Push / VAPID)
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(200) NOT NULL,
    auth VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_endpoint (endpoint),
    INDEX idx_push_user_id (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;