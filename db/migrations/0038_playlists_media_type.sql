-- Migration: 0038_playlists_media_type
-- Description: Add media type to playlists to distinguish movie vs series playlists

ALTER TABLE playlists ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movies'
  CHECK (media_type IN ('movies', 'series'));

CREATE INDEX idx_playlists_media_type ON playlists(user_id, media_type);

COMMENT ON COLUMN playlists.media_type IS 'Type of playlist content: movies or series';



