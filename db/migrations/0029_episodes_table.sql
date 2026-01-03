-- Migration: 0029_episodes_table
-- Description: Create episodes table for storing TV episode metadata

CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  provider_item_id TEXT NOT NULL UNIQUE,

  -- Episode identity
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  overview TEXT,

  -- Air info
  premiere_date DATE,
  year INTEGER,

  -- Runtime
  runtime_minutes INTEGER,

  -- Ratings
  community_rating NUMERIC(5,2),

  -- Creative team (episode-specific)
  directors TEXT[] DEFAULT '{}',
  writers TEXT[] DEFAULT '{}',
  guest_stars JSONB DEFAULT '[]'::JSONB,

  -- Media info
  path TEXT,
  media_sources JSONB DEFAULT '[]'::JSONB,

  -- Images
  poster_url TEXT,

  -- Unique constraint per series/season/episode
  CONSTRAINT episodes_series_season_episode_unique 
    UNIQUE (series_id, season_number, episode_number)
);

-- Indexes
CREATE INDEX idx_episodes_series_id ON episodes(series_id);
CREATE INDEX idx_episodes_season ON episodes(series_id, season_number);
CREATE INDEX idx_episodes_premiere_date ON episodes(premiere_date);

-- Apply updated_at trigger
CREATE TRIGGER trigger_episodes_updated_at
  BEFORE UPDATE ON episodes FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE episodes IS 'TV episode metadata synced from media server';
COMMENT ON COLUMN episodes.series_id IS 'Reference to parent series';
COMMENT ON COLUMN episodes.season_number IS 'Season number (1-based)';
COMMENT ON COLUMN episodes.episode_number IS 'Episode number within season (1-based)';
COMMENT ON COLUMN episodes.guest_stars IS 'Guest stars with name, role, and thumbnail URL';

