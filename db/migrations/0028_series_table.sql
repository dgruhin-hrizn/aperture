-- Migration: 0028_series_table
-- Description: Create series table for storing TV series metadata

CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Media server reference
  provider_item_id TEXT NOT NULL UNIQUE,
  provider_library_id VARCHAR(255),

  -- Basic metadata (same as movies)
  title TEXT NOT NULL,
  original_title TEXT,
  sort_title TEXT,
  year INTEGER,                           -- First air year
  end_year INTEGER,                       -- Last air year (NULL if ongoing)
  genres TEXT[] DEFAULT '{}',
  overview TEXT,
  tagline TEXT,

  -- Ratings
  community_rating NUMERIC(5,2),
  critic_rating NUMERIC(5,2),
  content_rating TEXT,                    -- TV-MA, TV-14, etc.

  -- Series-specific
  status TEXT,                            -- 'Continuing', 'Ended'
  total_seasons INTEGER,
  total_episodes INTEGER,
  air_days TEXT[] DEFAULT '{}',           -- Days it airs
  network TEXT,                           -- Primary network/studio

  -- Creative team (same as movies)
  studios TEXT[] DEFAULT '{}',
  directors TEXT[] DEFAULT '{}',          -- Series creators
  writers TEXT[] DEFAULT '{}',
  actors JSONB DEFAULT '[]'::JSONB,

  -- External IDs
  imdb_id TEXT,
  tmdb_id TEXT,
  tvdb_id TEXT,

  -- Tags and metadata
  tags TEXT[] DEFAULT '{}',
  production_countries TEXT[] DEFAULT '{}',
  awards TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Images
  poster_url TEXT,
  backdrop_url TEXT
);

-- Indexes (same pattern as movies)
CREATE INDEX idx_series_title ON series(title);
CREATE INDEX idx_series_year ON series(year);
CREATE INDEX idx_series_genres ON series USING GIN(genres);
CREATE INDEX idx_series_provider_library_id ON series(provider_library_id);
CREATE INDEX idx_series_content_rating ON series(content_rating);
CREATE INDEX idx_series_imdb_id ON series(imdb_id);
CREATE INDEX idx_series_tmdb_id ON series(tmdb_id);
CREATE INDEX idx_series_tvdb_id ON series(tvdb_id);
CREATE INDEX idx_series_studios ON series USING GIN(studios);

-- Apply updated_at trigger
CREATE TRIGGER trigger_series_updated_at
  BEFORE UPDATE ON series FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE series IS 'TV series metadata synced from media server';
COMMENT ON COLUMN series.provider_item_id IS 'Item ID in the media server (Emby/Jellyfin)';
COMMENT ON COLUMN series.year IS 'First air year';
COMMENT ON COLUMN series.end_year IS 'Last air year (NULL if series is ongoing)';
COMMENT ON COLUMN series.status IS 'Series status: Continuing, Ended, etc.';
COMMENT ON COLUMN series.network IS 'Primary network or streaming service';


