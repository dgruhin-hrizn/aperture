-- Migration: 0006_movies
-- Description: Create movies table for storing media server movie metadata

CREATE TABLE movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Media server reference
  provider_item_id TEXT NOT NULL UNIQUE,

  -- Basic metadata
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  genres TEXT[] DEFAULT '{}',
  overview TEXT,

  -- Ratings
  community_rating NUMERIC(3, 1),
  critic_rating NUMERIC(3, 1),

  -- Technical details
  runtime_minutes INTEGER,

  -- Media server paths (for STRM generation)
  path TEXT,
  media_sources JSONB DEFAULT '[]'::JSONB,

  -- Additional metadata from provider
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Poster/backdrop URLs
  poster_url TEXT,
  backdrop_url TEXT
);

-- Indexes
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movies_year ON movies(year);
CREATE INDEX idx_movies_genres ON movies USING GIN(genres);

-- Apply updated_at trigger
CREATE TRIGGER trigger_movies_updated_at
  BEFORE UPDATE ON movies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE movies IS 'Movie metadata synced from media server';
COMMENT ON COLUMN movies.provider_item_id IS 'Item ID in the media server (Emby/Jellyfin)';
COMMENT ON COLUMN movies.media_sources IS 'Array of media source objects with file paths';

