-- Backup configuration table for storing backup settings
-- Stores backup path, retention count, and last backup info

CREATE TABLE IF NOT EXISTS backup_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  backup_path TEXT NOT NULL DEFAULT '/backups',
  retention_count INTEGER NOT NULL DEFAULT 7,
  last_backup_at TIMESTAMPTZ,
  last_backup_filename TEXT,
  last_backup_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure only one row exists
  CONSTRAINT backup_config_single_row CHECK (id = 1)
);

-- Add constraint for valid retention count (1-100)
ALTER TABLE backup_config
  ADD CONSTRAINT backup_config_retention_check
  CHECK (retention_count >= 1 AND retention_count <= 100);

-- Create updated_at trigger
CREATE TRIGGER backup_config_updated_at
  BEFORE UPDATE ON backup_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration
INSERT INTO backup_config (id, backup_path, retention_count)
VALUES (1, '/backups', 7)
ON CONFLICT (id) DO NOTHING;

-- Add backup-database job to job_config with default schedule (daily at 2 AM)
INSERT INTO job_config (job_name, schedule_type, schedule_hour, schedule_minute, is_enabled)
VALUES ('backup-database', 'daily', 2, 0, true)
ON CONFLICT (job_name) DO NOTHING;

