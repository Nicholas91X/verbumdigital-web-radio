-- ============================================
-- Migration 003: Stripe Connect & Donations
-- ============================================

-- Add Stripe fields to churches
ALTER TABLE churches
    ADD COLUMN stripe_account_id VARCHAR(255) NULL,
    ADD COLUMN stripe_onboarding_complete TINYINT(1) NOT NULL DEFAULT 0;

-- Add Stripe customer ID to users (future: saved cards)
ALTER TABLE users
    ADD COLUMN stripe_customer_id VARCHAR(255) NULL;

-- Add donation fields to streaming_sessions
ALTER TABLE streaming_sessions
    ADD COLUMN donation_active TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN donation_preset_id INT NULL;

-- Create donation_presets table
CREATE TABLE IF NOT EXISTS donation_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    church_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    amounts JSON NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_preset_church FOREIGN KEY (church_id) REFERENCES churches (id) ON DELETE CASCADE,
    INDEX idx_preset_church (church_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    church_id INT NOT NULL,
    session_id INT NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'eur',
    stripe_payment_intent_id VARCHAR(255) NULL,
    stripe_checkout_session_id VARCHAR(255) NULL,
    status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_donation_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_donation_church FOREIGN KEY (church_id) REFERENCES churches (id) ON DELETE CASCADE,
    CONSTRAINT fk_donation_session FOREIGN KEY (session_id) REFERENCES streaming_sessions (id) ON DELETE SET NULL,
    INDEX idx_donation_church (church_id),
    INDEX idx_donation_session (session_id),
    INDEX idx_donation_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Add FK for donation_preset_id on streaming_sessions (after donation_presets exists)
ALTER TABLE streaming_sessions
    ADD CONSTRAINT fk_session_donation_preset
    FOREIGN KEY (donation_preset_id) REFERENCES donation_presets (id) ON DELETE SET NULL;
