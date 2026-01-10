-- Migration: 0061_setup_progress
-- Description: Persist setup wizard progress for resumable onboarding + admin rerun

-- A single-row table tracking setup progress. We use id=1.
CREATE TABLE IF NOT EXISTS setup_progress (
  id integer PRIMARY KEY DEFAULT 1,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step text NULL,
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Ensure single-row exists
INSERT INTO setup_progress (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Auto-update updated_at on row update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_setup_progress_updated_at'
  ) THEN
    CREATE TRIGGER trigger_setup_progress_updated_at
      BEFORE UPDATE ON setup_progress
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


