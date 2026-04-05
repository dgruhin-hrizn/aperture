-- Migration: 0106_gap_analysis
-- Description: Movie collection gap analysis runs/results; discovery_requests.source for gap vs discovery

-- ============================================================================
-- GAP ANALYSIS RUNS
-- ============================================================================

CREATE TABLE gap_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,

  collections_scanned INTEGER NOT NULL DEFAULT 0,
  total_parts INTEGER NOT NULL DEFAULT 0,
  owned_parts INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_gap_analysis_runs_created_at ON gap_analysis_runs(created_at DESC);
CREATE INDEX idx_gap_analysis_runs_status ON gap_analysis_runs(status);

COMMENT ON TABLE gap_analysis_runs IS 'Snapshot runs comparing TMDB collection parts vs library movies';

-- ============================================================================
-- GAP ANALYSIS RESULTS (missing titles per run)
-- ============================================================================

CREATE TABLE gap_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  run_id UUID NOT NULL REFERENCES gap_analysis_runs(id) ON DELETE CASCADE,

  collection_id INTEGER NOT NULL,
  collection_name TEXT NOT NULL,
  collection_poster_path TEXT,

  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  release_year INTEGER,
  release_date TEXT,
  poster_path TEXT,

  CONSTRAINT gap_analysis_results_run_collection_tmdb UNIQUE (run_id, collection_id, tmdb_id)
);

CREATE INDEX idx_gap_analysis_results_run_id ON gap_analysis_results(run_id);
CREATE INDEX idx_gap_analysis_results_collection_id ON gap_analysis_results(collection_id);
CREATE INDEX idx_gap_analysis_results_tmdb_id ON gap_analysis_results(tmdb_id);

COMMENT ON TABLE gap_analysis_results IS 'Missing collection parts (not in library) for a gap analysis run';

-- ============================================================================
-- DISCOVERY REQUESTS: source (discovery vs gap_analysis)
-- ============================================================================

ALTER TABLE discovery_requests
  ADD COLUMN source TEXT NOT NULL DEFAULT 'discovery';

CREATE INDEX idx_discovery_requests_source ON discovery_requests(user_id, source);

COMMENT ON COLUMN discovery_requests.source IS 'Origin: discovery (Discovery page) or gap_analysis (admin Movie Collection Gaps)';
