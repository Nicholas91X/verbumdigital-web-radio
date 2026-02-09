-- Migration rollback: 001_initial_schema_down.sql
-- Drops all tables in reverse dependency order

BEGIN;

DROP TABLE IF EXISTS active_listeners;

DROP TABLE IF EXISTS streaming_sessions;

DROP TABLE IF EXISTS user_subscriptions;

DROP TABLE IF EXISTS priest_churches;

DROP TABLE IF EXISTS streaming_credentials;

DROP TABLE IF EXISTS admins;

DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS priests;

DROP TABLE IF EXISTS churches;

DROP TABLE IF EXISTS machines;

COMMIT;