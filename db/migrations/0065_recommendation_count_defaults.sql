-- Migration: 0065_recommendation_count_defaults
-- Description: Update recommendation counts to 12 for both movies and series

-- Update default values in the table definition
ALTER TABLE recommendation_config 
  ALTER COLUMN movie_selected_count SET DEFAULT 12,
  ALTER COLUMN series_selected_count SET DEFAULT 12;

-- Update existing row to use the new defaults
UPDATE recommendation_config 
SET movie_selected_count = 12, series_selected_count = 12
WHERE id = 1;

COMMENT ON COLUMN recommendation_config.movie_selected_count IS 'Number of movie recommendations per user (default: 12)';
COMMENT ON COLUMN recommendation_config.series_selected_count IS 'Number of series recommendations per user (default: 12)';

