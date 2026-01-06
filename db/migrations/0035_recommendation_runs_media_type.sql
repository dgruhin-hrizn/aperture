-- Migration: 0035_recommendation_runs_media_type
-- Description: Add media type to recommendation_runs to distinguish movie vs series runs

ALTER TABLE recommendation_runs ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'
  CHECK (media_type IN ('movie', 'series'));

CREATE INDEX idx_recommendation_runs_media_type ON recommendation_runs(user_id, media_type);

COMMENT ON COLUMN recommendation_runs.media_type IS 'Type of recommendations: movie or series';


