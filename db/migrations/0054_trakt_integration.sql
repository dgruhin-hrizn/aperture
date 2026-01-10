-- Migration: 0054_trakt_integration
-- Description: Add Trakt OAuth fields to users table for ratings sync

-- Add Trakt OAuth fields to users table
ALTER TABLE users ADD COLUMN trakt_access_token TEXT;
ALTER TABLE users ADD COLUMN trakt_refresh_token TEXT;
ALTER TABLE users ADD COLUMN trakt_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN trakt_username TEXT;
ALTER TABLE users ADD COLUMN trakt_synced_at TIMESTAMPTZ;

-- Index for finding users with Trakt connected
CREATE INDEX idx_users_trakt_connected ON users(id) WHERE trakt_access_token IS NOT NULL;

COMMENT ON COLUMN users.trakt_access_token IS 'Trakt OAuth access token';
COMMENT ON COLUMN users.trakt_refresh_token IS 'Trakt OAuth refresh token';
COMMENT ON COLUMN users.trakt_token_expires_at IS 'When the Trakt access token expires';
COMMENT ON COLUMN users.trakt_username IS 'Connected Trakt account username';
COMMENT ON COLUMN users.trakt_synced_at IS 'Last time ratings were synced from Trakt';


