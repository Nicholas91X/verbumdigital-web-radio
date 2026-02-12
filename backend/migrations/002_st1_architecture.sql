-- Migration: 002_st1_architecture.sql
-- VerbumDigital — ST1-driven architecture changes
-- stream_key no longer used (Icecast global password is pre-configured on ST1)

-- Make stream_key nullable (deprecated field)
ALTER TABLE streaming_credentials
MODIFY COLUMN stream_key VARCHAR(255) NULL;

-- Ensure started_by_priest_id is nullable (sessions started by ST1 have no priest)
-- Already nullable in 001, but explicit for clarity
ALTER TABLE streaming_sessions
MODIFY COLUMN started_by_priest_id INT NULL;