-- Add library_id to movies table to track which library each movie belongs to
-- This allows filtering recommendations/queries to only use movies from enabled libraries

ALTER TABLE movies ADD COLUMN IF NOT EXISTS provider_library_id VARCHAR(255);

-- Index for efficient filtering by library
CREATE INDEX IF NOT EXISTS idx_movies_provider_library_id ON movies(provider_library_id);

COMMENT ON COLUMN movies.provider_library_id IS 'The library ID from Emby/Jellyfin that this movie belongs to';


