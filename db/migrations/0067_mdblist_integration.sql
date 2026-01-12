-- Migration: 0067_mdblist_integration
-- Description: Add MDBList integration for Top Picks popularity source and metadata enrichment,
--              API error tracking for user-friendly rate limit/auth error display,
--              and OMDB language/country fields

-- ============================================================================
-- MDBLIST API SETTINGS (stored in system_settings via existing functions)
-- Keys: mdblist_api_key, mdblist_enabled, mdblist_supporter_tier
-- ============================================================================

-- ============================================================================
-- TOP PICKS CONFIG: Add MDBList popularity source options
-- ============================================================================

-- Popularity source: 'local' (Emby watch history), 'mdblist' (curated list), 'hybrid' (blend both)
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS popularity_source TEXT DEFAULT 'local';

-- MDBList list IDs for movies and series
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS mdblist_movies_list_id INTEGER;
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS mdblist_series_list_id INTEGER;

-- MDBList list names (cached for display)
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS mdblist_movies_list_name TEXT;
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS mdblist_series_list_name TEXT;

-- Hybrid mode weights (when popularity_source = 'hybrid')
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS hybrid_local_weight NUMERIC(3,2) DEFAULT 0.50;
ALTER TABLE top_picks_config ADD COLUMN IF NOT EXISTS hybrid_mdblist_weight NUMERIC(3,2) DEFAULT 0.50;

-- ============================================================================
-- MOVIES TABLE: Add MDBList enrichment columns and languages
-- ============================================================================

-- Letterboxd rating (0-5 scale, e.g., 4.2)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS letterboxd_score NUMERIC(3,1);

-- MDBList aggregated score (0-100)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mdblist_score INTEGER;

-- Streaming providers (where content is available to stream)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS streaming_providers JSONB DEFAULT '[]'::JSONB;

-- MDBList keywords (may overlap with TMDb keywords)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mdblist_keywords TEXT[] DEFAULT '{}';

-- MDBList enrichment timestamp
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mdblist_enriched_at TIMESTAMPTZ;

-- Languages from OMDB (spoken languages in the movie)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- ============================================================================
-- SERIES TABLE: Add MDBList enrichment columns and languages
-- ============================================================================

-- Letterboxd rating
ALTER TABLE series ADD COLUMN IF NOT EXISTS letterboxd_score NUMERIC(3,1);

-- MDBList aggregated score
ALTER TABLE series ADD COLUMN IF NOT EXISTS mdblist_score INTEGER;

-- Streaming providers
ALTER TABLE series ADD COLUMN IF NOT EXISTS streaming_providers JSONB DEFAULT '[]'::JSONB;

-- MDBList keywords
ALTER TABLE series ADD COLUMN IF NOT EXISTS mdblist_keywords TEXT[] DEFAULT '{}';

-- MDBList enrichment timestamp
ALTER TABLE series ADD COLUMN IF NOT EXISTS mdblist_enriched_at TIMESTAMPTZ;

-- Languages from OMDB
ALTER TABLE series ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- ============================================================================
-- API ERRORS TABLE: Track rate limits, auth failures, and outages
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'openai', 'mdblist', 'tmdb', 'omdb', 'trakt'
  error_type TEXT NOT NULL, -- 'rate_limit', 'auth', 'limit', 'outage'
  error_code TEXT, -- Provider-specific code (e.g., '25' for TMDb rate limit)
  http_status INTEGER,
  job_id UUID REFERENCES job_runs(id) ON DELETE SET NULL,
  error_message TEXT,
  reset_at TIMESTAMPTZ, -- When the rate limit resets (if known from headers)
  action_url TEXT, -- Link to provider dashboard for user action
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ -- User dismissed the alert
);

-- Index for finding active (non-dismissed) errors by provider
CREATE INDEX IF NOT EXISTS idx_api_errors_active ON api_errors(provider, error_type, created_at) 
  WHERE dismissed_at IS NULL;

-- Index for cleanup of old dismissed errors
CREATE INDEX IF NOT EXISTS idx_api_errors_dismissed ON api_errors(dismissed_at)
  WHERE dismissed_at IS NOT NULL;

-- ============================================================================
-- INDEXES for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_movies_letterboxd_score ON movies(letterboxd_score);
CREATE INDEX IF NOT EXISTS idx_movies_mdblist_score ON movies(mdblist_score);
CREATE INDEX IF NOT EXISTS idx_movies_mdblist_enriched_at ON movies(mdblist_enriched_at);
CREATE INDEX IF NOT EXISTS idx_movies_streaming_providers ON movies USING GIN(streaming_providers);
CREATE INDEX IF NOT EXISTS idx_movies_languages ON movies USING GIN(languages);

CREATE INDEX IF NOT EXISTS idx_series_letterboxd_score ON series(letterboxd_score);
CREATE INDEX IF NOT EXISTS idx_series_mdblist_score ON series(mdblist_score);
CREATE INDEX IF NOT EXISTS idx_series_mdblist_enriched_at ON series(mdblist_enriched_at);
CREATE INDEX IF NOT EXISTS idx_series_streaming_providers ON series USING GIN(streaming_providers);
CREATE INDEX IF NOT EXISTS idx_series_languages ON series USING GIN(languages);

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- Top Picks Config comments
COMMENT ON COLUMN top_picks_config.popularity_source IS 'Source for popularity data: local (Emby watch history), mdblist (curated list), hybrid (blend both)';
COMMENT ON COLUMN top_picks_config.mdblist_movies_list_id IS 'MDBList list ID for movie rankings';
COMMENT ON COLUMN top_picks_config.mdblist_series_list_id IS 'MDBList list ID for series rankings';
COMMENT ON COLUMN top_picks_config.mdblist_movies_list_name IS 'Cached name of the MDBList movie list';
COMMENT ON COLUMN top_picks_config.mdblist_series_list_name IS 'Cached name of the MDBList series list';
COMMENT ON COLUMN top_picks_config.hybrid_local_weight IS 'Weight for local popularity in hybrid mode (0.00-1.00)';
COMMENT ON COLUMN top_picks_config.hybrid_mdblist_weight IS 'Weight for MDBList popularity in hybrid mode (0.00-1.00)';

-- Movies comments
COMMENT ON COLUMN movies.letterboxd_score IS 'Letterboxd rating (0.0-5.0)';
COMMENT ON COLUMN movies.mdblist_score IS 'MDBList aggregated score (0-100)';
COMMENT ON COLUMN movies.streaming_providers IS 'Streaming services where available (e.g., [{id: 8, name: "Netflix"}])';
COMMENT ON COLUMN movies.mdblist_keywords IS 'Keywords from MDBList';
COMMENT ON COLUMN movies.mdblist_enriched_at IS 'When MDBList metadata was last fetched';
COMMENT ON COLUMN movies.languages IS 'Spoken languages (e.g., ["English", "French"])';

-- Series comments
COMMENT ON COLUMN series.letterboxd_score IS 'Letterboxd rating (0.0-5.0)';
COMMENT ON COLUMN series.mdblist_score IS 'MDBList aggregated score (0-100)';
COMMENT ON COLUMN series.streaming_providers IS 'Streaming services where available';
COMMENT ON COLUMN series.mdblist_keywords IS 'Keywords from MDBList';
COMMENT ON COLUMN series.mdblist_enriched_at IS 'When MDBList metadata was last fetched';
COMMENT ON COLUMN series.languages IS 'Spoken languages';

-- API Errors comments
COMMENT ON TABLE api_errors IS 'Tracks API errors (rate limits, auth failures, outages) for user-friendly display';
COMMENT ON COLUMN api_errors.provider IS 'External API provider: openai, mdblist, tmdb, omdb, trakt';
COMMENT ON COLUMN api_errors.error_type IS 'Category: rate_limit (retry later), auth (user action needed), limit (account limit), outage (service down)';
COMMENT ON COLUMN api_errors.error_code IS 'Provider-specific error code (e.g., TMDb status_code 25)';
COMMENT ON COLUMN api_errors.reset_at IS 'When rate limit resets (parsed from X-RateLimit-Reset or Retry-After headers)';
COMMENT ON COLUMN api_errors.action_url IS 'URL where user can resolve the issue (e.g., billing page)';
COMMENT ON COLUMN api_errors.dismissed_at IS 'When user dismissed this error alert';



