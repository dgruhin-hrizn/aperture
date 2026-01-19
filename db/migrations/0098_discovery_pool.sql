-- Discovery Pool: Shared candidate storage
-- Reduces duplicate API calls and DB storage for global discovery candidates

-- ============================================================================
-- New Table: discovery_pool
-- Stores global candidates (TMDb Discover, Trakt Trending/Popular) shared across users
-- ============================================================================

CREATE TABLE discovery_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),
  tmdb_id INTEGER NOT NULL,
  
  -- Cached metadata (shared across users)
  imdb_id TEXT,
  title TEXT NOT NULL,
  original_title TEXT,
  original_language TEXT,
  release_year INTEGER,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  genres JSONB DEFAULT '[]',
  vote_average NUMERIC(4,2),
  vote_count INTEGER,
  popularity NUMERIC(10,2),
  
  -- Enrichment data (fetched once, shared)
  cast_members JSONB,
  directors TEXT[],
  runtime_minutes INTEGER,
  tagline TEXT,
  is_enriched BOOLEAN DEFAULT FALSE,
  
  -- Source tracking (which global sources included this candidate)
  sources TEXT[] NOT NULL DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(media_type, tmdb_id)
);

-- Indexes for discovery_pool
CREATE INDEX idx_discovery_pool_media_type ON discovery_pool(media_type);
CREATE INDEX idx_discovery_pool_tmdb_id ON discovery_pool(tmdb_id);
CREATE INDEX idx_discovery_pool_updated ON discovery_pool(updated_at);
CREATE INDEX idx_discovery_pool_media_tmdb ON discovery_pool(media_type, tmdb_id);

-- ============================================================================
-- Modify: discovery_candidates
-- Add pool reference and personalization tracking
-- ============================================================================

-- Add column to reference shared pool (NULL for personalized-only candidates)
ALTER TABLE discovery_candidates 
  ADD COLUMN pool_id UUID REFERENCES discovery_pool(id) ON DELETE SET NULL;

-- Track if this candidate came from a personalized source
ALTER TABLE discovery_candidates 
  ADD COLUMN is_personalized BOOLEAN DEFAULT FALSE;

-- Index for pool lookups
CREATE INDEX idx_discovery_candidates_pool_id ON discovery_candidates(pool_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE discovery_pool IS 'Shared pool of global discovery candidates (TMDb Discover, Trakt Trending/Popular)';
COMMENT ON COLUMN discovery_pool.sources IS 'Array of sources that included this candidate: tmdb_discover, trakt_trending, trakt_popular';
COMMENT ON COLUMN discovery_candidates.pool_id IS 'Reference to shared pool entry (NULL for personalized-only candidates)';
COMMENT ON COLUMN discovery_candidates.is_personalized IS 'TRUE if candidate came from user-specific recommendations';
