-- Enrichment Run Tracking
-- 
-- Tracks enrichment job runs to detect incomplete runs (e.g. container restarts)
-- and allow proper resumption. Without this, if a job crashes mid-run, users
-- see "All items enriched" on restart because in-memory state is lost.
--
-- This table persists expected vs actual counts so we can:
-- 1. Detect incomplete runs
-- 2. Show accurate status to users
-- 3. Allow resumption or reset of stuck runs

CREATE TABLE IF NOT EXISTS enrichment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What version this run is targeting
  target_version INT NOT NULL,
  
  -- Expected counts at start of run (from initial query)
  expected_movies INT NOT NULL DEFAULT 0,
  expected_series INT NOT NULL DEFAULT 0,
  
  -- Actual processed counts (updated during run)
  processed_movies INT NOT NULL DEFAULT 0,
  processed_series INT NOT NULL DEFAULT 0,
  enriched_movies INT NOT NULL DEFAULT 0,
  enriched_series INT NOT NULL DEFAULT 0,
  failed_movies INT NOT NULL DEFAULT 0,
  failed_series INT NOT NULL DEFAULT 0,
  
  -- Status: 'running', 'completed', 'failed', 'cancelled', 'interrupted'
  -- 'interrupted' = detected as incomplete on next startup
  status TEXT NOT NULL DEFAULT 'running',
  
  -- Job ID (links to job_runs if it completed)
  job_id UUID,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint for valid status
ALTER TABLE enrichment_runs
  ADD CONSTRAINT enrichment_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'interrupted'));

-- Index for finding running/incomplete runs
CREATE INDEX idx_enrichment_runs_status ON enrichment_runs(status);
CREATE INDEX idx_enrichment_runs_started ON enrichment_runs(started_at DESC);

-- Comments
COMMENT ON TABLE enrichment_runs IS 'Tracks enrichment job runs to detect and recover from incomplete runs';
COMMENT ON COLUMN enrichment_runs.target_version IS 'The enrichment_version this run is targeting';
COMMENT ON COLUMN enrichment_runs.expected_movies IS 'Number of movies needing enrichment at start';
COMMENT ON COLUMN enrichment_runs.expected_series IS 'Number of series needing enrichment at start';
COMMENT ON COLUMN enrichment_runs.status IS 'running=in progress, completed=success, failed=error, cancelled=user stopped, interrupted=crashed/restarted';


