-- ============================================
-- Migration 004: Heartbeat for streaming sessions
-- ============================================

-- Add last_heartbeat column to streaming_sessions.
-- ST1 updates this every 30s while streaming.
-- The backend watchdog uses this to auto-close stale sessions.
ALTER TABLE streaming_sessions
    ADD COLUMN last_heartbeat DATETIME NULL;
