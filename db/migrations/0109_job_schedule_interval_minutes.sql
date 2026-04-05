-- Sub-hour interval schedules (15 / 30 minutes). Mutually exclusive with schedule_interval_hours.

ALTER TABLE job_config DROP CONSTRAINT IF EXISTS job_config_interval_hours_check;

ALTER TABLE job_config ADD COLUMN IF NOT EXISTS schedule_interval_minutes INTEGER;

ALTER TABLE job_config ADD CONSTRAINT job_config_interval_hours_check
  CHECK (schedule_interval_hours IS NULL OR schedule_interval_hours IN (1, 2, 3, 4, 6, 8, 12));

ALTER TABLE job_config ADD CONSTRAINT job_config_interval_minutes_check
  CHECK (schedule_interval_minutes IS NULL OR schedule_interval_minutes IN (15, 30));

ALTER TABLE job_config ADD CONSTRAINT job_config_interval_mutual_exclusive_check
  CHECK (schedule_interval_hours IS NULL OR schedule_interval_minutes IS NULL);
