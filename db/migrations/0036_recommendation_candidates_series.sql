-- Migration: 0036_recommendation_candidates_series
-- Description: Extend recommendation_candidates to support series

-- Make movie_id nullable
ALTER TABLE recommendation_candidates ALTER COLUMN movie_id DROP NOT NULL;

-- Add series reference
ALTER TABLE recommendation_candidates ADD COLUMN series_id UUID REFERENCES series(id) ON DELETE CASCADE;

-- Add check constraint: exactly one of movie_id or series_id must be set
ALTER TABLE recommendation_candidates ADD CONSTRAINT recommendation_candidates_media_check
  CHECK (
    (movie_id IS NOT NULL AND series_id IS NULL) OR 
    (movie_id IS NULL AND series_id IS NOT NULL)
  );

-- Add index for series lookups
CREATE INDEX idx_recommendation_candidates_series_id ON recommendation_candidates(series_id);

COMMENT ON COLUMN recommendation_candidates.series_id IS 'Reference to series (for TV recommendations)';



