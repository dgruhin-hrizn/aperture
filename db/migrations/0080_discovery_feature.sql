-- Migration: 0080_discovery_feature
-- Description: Add Discovery feature for suggesting content not in user's library,
--              with Jellyseerr integration for content requests

-- ============================================================================
-- USER COLUMNS: Discovery permissions
-- ============================================================================

-- Enable/disable discovery suggestions per user
ALTER TABLE users ADD COLUMN discover_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Enable/disable Jellyseerr request capability per user
ALTER TABLE users ADD COLUMN discover_request_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes for efficient filtering
CREATE INDEX idx_users_discover_enabled ON users(discover_enabled) WHERE discover_enabled = TRUE;
CREATE INDEX idx_users_discover_request_enabled ON users(discover_request_enabled) WHERE discover_request_enabled = TRUE;

COMMENT ON COLUMN users.discover_enabled IS 'Whether user can see Discovery suggestions for content not in library';
COMMENT ON COLUMN users.discover_request_enabled IS 'Whether user can request missing content via Jellyseerr';

-- ============================================================================
-- DISCOVERY RUNS TABLE: Track job executions per user
-- ============================================================================

CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User this run was for
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Media type
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),

  -- Run metadata
  run_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (run_type IN ('scheduled', 'manual')),

  -- Run statistics
  candidates_fetched INTEGER NOT NULL DEFAULT 0,
  candidates_filtered INTEGER NOT NULL DEFAULT 0, -- After removing library/watched
  candidates_scored INTEGER NOT NULL DEFAULT 0,
  candidates_stored INTEGER NOT NULL DEFAULT 0, -- Final count saved
  duration_ms INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Indexes for discovery_runs
CREATE INDEX idx_discovery_runs_user_id ON discovery_runs(user_id);
CREATE INDEX idx_discovery_runs_created_at ON discovery_runs(created_at DESC);
CREATE INDEX idx_discovery_runs_user_media_type ON discovery_runs(user_id, media_type, created_at DESC);

COMMENT ON TABLE discovery_runs IS 'Records of discovery suggestion generation runs';
COMMENT ON COLUMN discovery_runs.media_type IS 'Type of media: movie or series';
COMMENT ON COLUMN discovery_runs.candidates_fetched IS 'Total candidates fetched from external sources';
COMMENT ON COLUMN discovery_runs.candidates_filtered IS 'Candidates after filtering library/watched';
COMMENT ON COLUMN discovery_runs.candidates_scored IS 'Candidates that were AI-scored';
COMMENT ON COLUMN discovery_runs.candidates_stored IS 'Final candidates saved to cache';

-- ============================================================================
-- DISCOVERY CANDIDATES TABLE: Cached recommendations with scores
-- ============================================================================

CREATE TABLE discovery_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Media type and external ID
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),
  tmdb_id INTEGER NOT NULL,

  -- Position and selection
  rank INTEGER NOT NULL,

  -- Scores
  final_score NUMERIC(6, 4) NOT NULL,
  similarity_score NUMERIC(6, 4), -- AI similarity to user's taste
  popularity_score NUMERIC(6, 4), -- From trending/popular lists
  recency_score NUMERIC(6, 4), -- Bonus for newer content
  source_score NUMERIC(6, 4), -- Score from recommendation source

  -- Source tracking (where this candidate came from)
  source TEXT NOT NULL CHECK (source IN ('tmdb_recommendations', 'tmdb_similar', 'tmdb_discover', 'trakt_trending', 'trakt_popular', 'trakt_recommendations', 'mdblist')),
  source_media_id INTEGER, -- TMDb ID of the movie/series that generated this recommendation (for "similar to X" context)

  -- Cached metadata (avoid re-fetching)
  title TEXT NOT NULL,
  original_title TEXT,
  release_year INTEGER,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  genres JSONB DEFAULT '[]'::JSONB,
  vote_average NUMERIC(3, 1),
  vote_count INTEGER,

  -- Additional scoring factors
  score_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Unique constraint per user/media combo (only keep latest)
  CONSTRAINT discovery_candidates_user_media_unique UNIQUE (user_id, media_type, tmdb_id)
);

-- Indexes for discovery_candidates
CREATE INDEX idx_discovery_candidates_run_id ON discovery_candidates(run_id);
CREATE INDEX idx_discovery_candidates_user_id ON discovery_candidates(user_id);
CREATE INDEX idx_discovery_candidates_user_type_rank ON discovery_candidates(user_id, media_type, rank);
CREATE INDEX idx_discovery_candidates_tmdb_id ON discovery_candidates(tmdb_id);
CREATE INDEX idx_discovery_candidates_final_score ON discovery_candidates(user_id, media_type, final_score DESC);

COMMENT ON TABLE discovery_candidates IS 'Cached discovery suggestions for users (content not in their library)';
COMMENT ON COLUMN discovery_candidates.tmdb_id IS 'TMDb ID for the movie or series';
COMMENT ON COLUMN discovery_candidates.source IS 'Where this recommendation came from';
COMMENT ON COLUMN discovery_candidates.source_media_id IS 'TMDb ID of media that generated this (for "Because you liked X" context)';
COMMENT ON COLUMN discovery_candidates.score_breakdown IS 'Detailed breakdown of all scoring factors';

-- ============================================================================
-- DISCOVERY REQUESTS TABLE: Track Jellyseerr request submissions
-- ============================================================================

CREATE TABLE discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Who requested it
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What was requested
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,

  -- Jellyseerr request info
  jellyseerr_request_id INTEGER, -- Jellyseerr's internal request ID
  jellyseerr_media_id INTEGER, -- Jellyseerr's internal media ID

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'declined', 'available', 'failed')),
  status_message TEXT,

  -- Reference to discovery candidate (if it came from discovery)
  discovery_candidate_id UUID REFERENCES discovery_candidates(id) ON DELETE SET NULL
);

-- Indexes for discovery_requests
CREATE INDEX idx_discovery_requests_user_id ON discovery_requests(user_id);
CREATE INDEX idx_discovery_requests_status ON discovery_requests(status);
CREATE INDEX idx_discovery_requests_tmdb_id ON discovery_requests(tmdb_id);
CREATE INDEX idx_discovery_requests_user_tmdb ON discovery_requests(user_id, tmdb_id);
CREATE INDEX idx_discovery_requests_created_at ON discovery_requests(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER discovery_requests_updated_at
  BEFORE UPDATE ON discovery_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE discovery_requests IS 'Tracks content requests submitted to Jellyseerr from Aperture';
COMMENT ON COLUMN discovery_requests.jellyseerr_request_id IS 'Request ID in Jellyseerr system';
COMMENT ON COLUMN discovery_requests.jellyseerr_media_id IS 'Media ID in Jellyseerr system';
COMMENT ON COLUMN discovery_requests.status IS 'Request status: pending, submitted, approved, declined, available, failed';
COMMENT ON COLUMN discovery_requests.discovery_candidate_id IS 'Link to discovery candidate if request originated from Discovery page';

-- ============================================================================
-- JELLYSEERR CONFIG (stored in system_settings via existing functions)
-- Keys: jellyseerr_url, jellyseerr_api_key, jellyseerr_enabled
-- ============================================================================

-- No table changes needed - uses existing system_settings table


