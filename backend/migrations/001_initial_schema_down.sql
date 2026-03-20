-- Migration rollback: 001_initial_schema_down.sql (MySQL)
-- Drops all tables in reverse dependency order

DROP TABLE IF EXISTS active_listeners;

DROP TABLE IF EXISTS streaming_sessions;

ALTER TABLE churches DROP FOREIGN KEY fk_churches_current_session;

DROP TABLE IF EXISTS user_subscriptions;

DROP TABLE IF EXISTS priest_churches;

DROP TABLE IF EXISTS streaming_credentials;

DROP TABLE IF EXISTS admins;

DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS priests;

DROP TABLE IF EXISTS churches;

DROP TABLE IF EXISTS machines;