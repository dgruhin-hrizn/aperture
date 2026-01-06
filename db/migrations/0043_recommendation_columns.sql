-- Migration: 0043_recommendation_columns
-- Description: Add missing columns for series recommendation support

-- Add selected_rank to recommendation_candidates
-- This tracks the rank among selected candidates (different from overall rank)
ALTER TABLE recommendation_candidates ADD COLUMN selected_rank INTEGER;

-- Add completed_at to recommendation_runs to track when runs finished
ALTER TABLE recommendation_runs ADD COLUMN completed_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN recommendation_candidates.selected_rank IS 'Rank among selected candidates (1-based, NULL if not selected)';
COMMENT ON COLUMN recommendation_runs.completed_at IS 'When the recommendation run finished';


