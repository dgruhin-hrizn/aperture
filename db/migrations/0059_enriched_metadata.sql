-- Migration: 0059_enriched_metadata
-- Description: Add TMDb keywords, collections/franchises, OMDb RT/Metacritic scores, and expanded crew

-- ============================================================================
-- MOVIES TABLE: Add enriched metadata columns
-- ============================================================================

-- TMDb Keywords (e.g., "time-travel", "heist", "based-on-novel")
ALTER TABLE movies ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- TMDb Collection/Franchise info
ALTER TABLE movies ADD COLUMN IF NOT EXISTS collection_id TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS collection_name TEXT;

-- Rotten Tomatoes scores (from OMDb)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS rt_critic_score INTEGER;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS rt_audience_score INTEGER;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS rt_consensus TEXT;

-- Metacritic score (from OMDb)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS metacritic_score INTEGER;

-- Awards summary (more structured than existing awards column)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS awards_summary TEXT;

-- Expanded crew beyond directors/writers
ALTER TABLE movies ADD COLUMN IF NOT EXISTS cinematographers TEXT[] DEFAULT '{}';
ALTER TABLE movies ADD COLUMN IF NOT EXISTS composers TEXT[] DEFAULT '{}';
ALTER TABLE movies ADD COLUMN IF NOT EXISTS editors TEXT[] DEFAULT '{}';

-- Enrichment tracking
ALTER TABLE movies ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ============================================================================
-- SERIES TABLE: Add enriched metadata columns
-- ============================================================================

-- TMDb Keywords
ALTER TABLE series ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Rotten Tomatoes scores
ALTER TABLE series ADD COLUMN IF NOT EXISTS rt_critic_score INTEGER;
ALTER TABLE series ADD COLUMN IF NOT EXISTS rt_audience_score INTEGER;
ALTER TABLE series ADD COLUMN IF NOT EXISTS rt_consensus TEXT;

-- Metacritic score
ALTER TABLE series ADD COLUMN IF NOT EXISTS metacritic_score INTEGER;

-- Awards summary
ALTER TABLE series ADD COLUMN IF NOT EXISTS awards_summary TEXT;

-- Enrichment tracking
ALTER TABLE series ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ============================================================================
-- COLLECTIONS TABLE: Store franchise/collection data from TMDb
-- ============================================================================

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- TMDb reference
  tmdb_id TEXT NOT NULL UNIQUE,
  
  -- Collection metadata
  name TEXT NOT NULL,
  overview TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  
  -- Cached counts (updated by trigger or job)
  movie_count INTEGER DEFAULT 0,
  
  -- Enrichment tracking
  enriched_at TIMESTAMPTZ
);

-- Apply updated_at trigger to collections
DROP TRIGGER IF EXISTS trigger_collections_updated_at ON collections;
CREATE TRIGGER trigger_collections_updated_at
  BEFORE UPDATE ON collections FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Movies indexes
CREATE INDEX IF NOT EXISTS idx_movies_keywords ON movies USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_movies_collection_id ON movies(collection_id);
CREATE INDEX IF NOT EXISTS idx_movies_collection_name ON movies(collection_name);
CREATE INDEX IF NOT EXISTS idx_movies_rt_critic_score ON movies(rt_critic_score);
CREATE INDEX IF NOT EXISTS idx_movies_metacritic_score ON movies(metacritic_score);
CREATE INDEX IF NOT EXISTS idx_movies_cinematographers ON movies USING GIN(cinematographers);
CREATE INDEX IF NOT EXISTS idx_movies_composers ON movies USING GIN(composers);
CREATE INDEX IF NOT EXISTS idx_movies_enriched_at ON movies(enriched_at);

-- Series indexes
CREATE INDEX IF NOT EXISTS idx_series_keywords ON series USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_series_rt_critic_score ON series(rt_critic_score);
CREATE INDEX IF NOT EXISTS idx_series_metacritic_score ON series(metacritic_score);
CREATE INDEX IF NOT EXISTS idx_series_enriched_at ON series(enriched_at);

-- Collections indexes
CREATE INDEX IF NOT EXISTS idx_collections_tmdb_id ON collections(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- Movies comments
COMMENT ON COLUMN movies.keywords IS 'TMDb keywords (e.g., time-travel, heist, based-on-novel)';
COMMENT ON COLUMN movies.collection_id IS 'TMDb collection ID for franchise grouping';
COMMENT ON COLUMN movies.collection_name IS 'Franchise/collection name (e.g., The Dark Knight Collection)';
COMMENT ON COLUMN movies.rt_critic_score IS 'Rotten Tomatoes Tomatometer (0-100)';
COMMENT ON COLUMN movies.rt_audience_score IS 'Rotten Tomatoes Audience Score (0-100)';
COMMENT ON COLUMN movies.rt_consensus IS 'Rotten Tomatoes Critics Consensus quote';
COMMENT ON COLUMN movies.metacritic_score IS 'Metacritic score (0-100)';
COMMENT ON COLUMN movies.awards_summary IS 'Awards summary (e.g., Won 4 Oscars. 12 nominations.)';
COMMENT ON COLUMN movies.cinematographers IS 'Director of Photography / Cinematographer names';
COMMENT ON COLUMN movies.composers IS 'Music composer names';
COMMENT ON COLUMN movies.editors IS 'Film editor names';
COMMENT ON COLUMN movies.enriched_at IS 'When TMDb/OMDb enrichment was last performed';

-- Series comments
COMMENT ON COLUMN series.keywords IS 'TMDb keywords';
COMMENT ON COLUMN series.rt_critic_score IS 'Rotten Tomatoes Tomatometer (0-100)';
COMMENT ON COLUMN series.rt_audience_score IS 'Rotten Tomatoes Audience Score (0-100)';
COMMENT ON COLUMN series.rt_consensus IS 'Rotten Tomatoes Critics Consensus quote';
COMMENT ON COLUMN series.metacritic_score IS 'Metacritic score (0-100)';
COMMENT ON COLUMN series.awards_summary IS 'Awards summary';
COMMENT ON COLUMN series.enriched_at IS 'When TMDb/OMDb enrichment was last performed';

-- Collections comments
COMMENT ON TABLE collections IS 'Movie collections/franchises from TMDb';
COMMENT ON COLUMN collections.tmdb_id IS 'TMDb collection ID';
COMMENT ON COLUMN collections.name IS 'Collection/franchise name';
COMMENT ON COLUMN collections.movie_count IS 'Number of movies in this collection in our library';

