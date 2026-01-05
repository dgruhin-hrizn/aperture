-- Migration: 0049_watch_history_management
-- Description: Add permission column for users to manage their watch history

-- Add can_manage_watch_history column to users table
-- Default to false - admin must explicitly enable for each user
ALTER TABLE users ADD COLUMN can_manage_watch_history BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.can_manage_watch_history IS 'When true, user can mark items as unwatched (syncs to Emby and removes from Aperture)';

