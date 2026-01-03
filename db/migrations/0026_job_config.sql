-- Job configuration table for storing per-job scheduling settings
-- Replaces environment variable cron settings with database-stored configuration

CREATE TABLE IF NOT EXISTS job_config (
  job_name TEXT PRIMARY KEY,
  schedule_type TEXT NOT NULL DEFAULT 'daily',  -- 'daily', 'weekly', 'interval', 'manual'
  schedule_hour INTEGER DEFAULT 3,               -- Hour of day (0-23)
  schedule_minute INTEGER DEFAULT 0,             -- Minute (0-59)
  schedule_day_of_week INTEGER,                  -- 0-6 for weekly (0=Sunday)
  schedule_interval_hours INTEGER,               -- For interval type (1,2,3,4,6,8,12)
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for valid schedule types
ALTER TABLE job_config
  ADD CONSTRAINT job_config_schedule_type_check
  CHECK (schedule_type IN ('daily', 'weekly', 'interval', 'manual'));

-- Add constraint for valid hour (0-23)
ALTER TABLE job_config
  ADD CONSTRAINT job_config_hour_check
  CHECK (schedule_hour >= 0 AND schedule_hour <= 23);

-- Add constraint for valid minute (0-59)
ALTER TABLE job_config
  ADD CONSTRAINT job_config_minute_check
  CHECK (schedule_minute >= 0 AND schedule_minute <= 59);

-- Add constraint for valid day of week (0-6)
ALTER TABLE job_config
  ADD CONSTRAINT job_config_day_of_week_check
  CHECK (schedule_day_of_week IS NULL OR (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6));

-- Add constraint for valid interval hours
ALTER TABLE job_config
  ADD CONSTRAINT job_config_interval_hours_check
  CHECK (schedule_interval_hours IS NULL OR schedule_interval_hours IN (1, 2, 3, 4, 6, 8, 12));

-- Create updated_at trigger
CREATE TRIGGER job_config_updated_at
  BEFORE UPDATE ON job_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default configurations for existing jobs
-- These match the current ENV defaults
INSERT INTO job_config (job_name, schedule_type, schedule_hour, schedule_minute)
VALUES
  ('sync-movies', 'daily', 3, 0),
  ('sync-watch-history', 'daily', 3, 0),
  ('generate-embeddings', 'manual', NULL, NULL),
  ('generate-recommendations', 'daily', 4, 0),
  ('rebuild-recommendations', 'manual', NULL, NULL),
  ('sync-strm', 'daily', 5, 0)
ON CONFLICT (job_name) DO NOTHING;

-- Update manual jobs to have correct schedule_type
UPDATE job_config SET schedule_type = 'manual' WHERE job_name IN ('generate-embeddings', 'rebuild-recommendations');

