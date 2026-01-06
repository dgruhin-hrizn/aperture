-- Migration: 0012_playlists
-- Description: Create playlists table for tracking media server playlists

CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Owner in our system
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Channel reference (null for user's main recommendations playlist)
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,

  -- Playlist details
  name TEXT NOT NULL,

  -- Media server playlist ID
  provider_playlist_id TEXT NOT NULL,

  -- Playlist type
  playlist_type TEXT NOT NULL DEFAULT 'recommendations'
    CHECK (playlist_type IN ('recommendations', 'channel', 'shared_channel')),

  -- For shared playlists, reference to original channel share
  channel_share_id UUID REFERENCES channel_shares(id) ON DELETE CASCADE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  item_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlists_channel_id ON playlists(channel_id);
CREATE INDEX idx_playlists_provider_id ON playlists(provider_playlist_id);

-- Apply updated_at trigger
CREATE TRIGGER trigger_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE playlists IS 'Playlists created in the media server for recommendations';
COMMENT ON COLUMN playlists.playlist_type IS 'Type: recommendations, channel, or shared_channel';


