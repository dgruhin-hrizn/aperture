-- Job run history table for tracking execution history
-- Stores completed job runs with their status, duration, and metadata

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'completed', 'failed', 'cancelled'
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  items_processed INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for valid status
ALTER TABLE job_runs
  ADD CONSTRAINT job_runs_status_check
  CHECK (status IN ('completed', 'failed', 'cancelled'));

-- Index for efficient querying by job name and time
CREATE INDEX idx_job_runs_job_name ON job_runs(job_name);
CREATE INDEX idx_job_runs_started_at ON job_runs(started_at DESC);
CREATE INDEX idx_job_runs_job_name_started ON job_runs(job_name, started_at DESC);

-- Add foreign key to job_config (optional, job names might not be pre-registered)
-- We skip this because new job types can be added dynamically

-- Add comments
COMMENT ON TABLE job_runs IS 'Historical log of job executions';
COMMENT ON COLUMN job_runs.job_name IS 'Name identifier of the job (e.g., sync-movies, generate-embeddings)';
COMMENT ON COLUMN job_runs.status IS 'Final status: completed, failed, or cancelled';
COMMENT ON COLUMN job_runs.started_at IS 'When the job started executing';
COMMENT ON COLUMN job_runs.completed_at IS 'When the job finished (success, error, or cancel)';
COMMENT ON COLUMN job_runs.duration_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN job_runs.items_processed IS 'Number of items successfully processed';
COMMENT ON COLUMN job_runs.items_total IS 'Total number of items that were to be processed';
COMMENT ON COLUMN job_runs.error_message IS 'Error message if status is failed';
COMMENT ON COLUMN job_runs.metadata IS 'Additional job-specific metadata as JSON';

-- Also add last_run columns to job_config for quick access
ALTER TABLE job_config ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE job_config ADD COLUMN IF NOT EXISTS last_run_status TEXT;
ALTER TABLE job_config ADD COLUMN IF NOT EXISTS last_run_duration_ms INTEGER;

COMMENT ON COLUMN job_config.last_run_at IS 'Timestamp of the last job run';
COMMENT ON COLUMN job_config.last_run_status IS 'Status of the last run: completed, failed, cancelled';
COMMENT ON COLUMN job_config.last_run_duration_ms IS 'Duration of the last run in milliseconds';



