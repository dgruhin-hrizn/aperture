-- Migration: 0010_channels
-- Description: Create channels and channel_shares tables

-- Channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Owner
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Channel definition
  name TEXT NOT NULL,
  description TEXT,

  -- Filters
  genre_filters TEXT[] DEFAULT '{}',
  text_preferences TEXT, -- Free-form text preferences for AI

  -- Example movies (for training the channel's taste)
  example_movie_ids UUID[] DEFAULT '{}',

  -- Output options
  is_pinned_row BOOLEAN NOT NULL DEFAULT FALSE, -- Create as STRM library row
  playlist_id TEXT, -- Media server playlist ID if created

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at TIMESTAMPTZ
);

-- Channel shares table
CREATE TABLE channel_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The playlist created for the shared user
  viewer_playlist_id TEXT,

  -- Unique constraint
  CONSTRAINT channel_shares_unique UNIQUE (channel_id, shared_with_user_id)
);

-- Indexes
CREATE INDEX idx_channels_owner_id ON channels(owner_id);
CREATE INDEX idx_channels_is_active ON channels(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_channel_shares_channel_id ON channel_shares(channel_id);
CREATE INDEX idx_channel_shares_user_id ON channel_shares(shared_with_user_id);

-- Apply updated_at trigger
CREATE TRIGGER trigger_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE channels IS 'User-created recommendation channels with custom filters';
COMMENT ON COLUMN channels.text_preferences IS 'Natural language preferences for AI filtering';
COMMENT ON COLUMN channels.is_pinned_row IS 'Whether to create a dedicated STRM library for this channel';
COMMENT ON TABLE channel_shares IS 'Channels shared with other users';



