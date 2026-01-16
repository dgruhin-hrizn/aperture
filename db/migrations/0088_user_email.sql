-- Migration: 0088_user_email
-- Description: Add email fields to users table for notifications

-- Add email column (synced from Emby, can be overridden by user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Add flag to lock email (prevents sync from overwriting user's custom email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Add email notifications opt-in (default to true - users must opt out)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for users with email notifications enabled (for sending notifications)
CREATE INDEX IF NOT EXISTS idx_users_email_notifications 
ON users(email) 
WHERE email IS NOT NULL AND email_notifications_enabled = TRUE;

COMMENT ON COLUMN users.email IS 'User email address, synced from Emby or manually set';
COMMENT ON COLUMN users.email_locked IS 'If true, email will not be overwritten by Emby sync';
COMMENT ON COLUMN users.email_notifications_enabled IS 'Whether user wants to receive email notifications';

