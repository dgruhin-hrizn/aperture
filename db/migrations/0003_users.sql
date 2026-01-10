-- Migration: 0003_users
-- Description: Create users table for storing media server user mappings

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Media server provider info
  provider TEXT NOT NULL CHECK (provider IN ('emby', 'jellyfin')),
  provider_user_id TEXT NOT NULL,

  -- User details
  username TEXT NOT NULL,
  display_name TEXT,

  -- Permissions
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Admin must enable for AI picks

  -- Provider access token (for making API calls on user's behalf)
  provider_access_token TEXT,

  -- Unique constraint per provider
  CONSTRAINT users_provider_user_id_unique UNIQUE (provider, provider_user_id)
);

-- Indexes
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_enabled ON users(is_enabled) WHERE is_enabled = TRUE;

COMMENT ON TABLE users IS 'Local users mapped from media server accounts';
COMMENT ON COLUMN users.provider IS 'Media server type: emby or jellyfin';
COMMENT ON COLUMN users.provider_user_id IS 'User ID in the media server';
COMMENT ON COLUMN users.is_enabled IS 'Whether AI recommendations are enabled for this user';



