-- Migration: 0042_split_recommendation_config
-- Description: Split recommendation_config into separate movie and series settings

-- Rename existing columns to movie_* prefix for clarity
ALTER TABLE recommendation_config RENAME COLUMN max_candidates TO movie_max_candidates;
ALTER TABLE recommendation_config RENAME COLUMN selected_count TO movie_selected_count;
ALTER TABLE recommendation_config RENAME COLUMN recent_watch_limit TO movie_recent_watch_limit;
ALTER TABLE recommendation_config RENAME COLUMN similarity_weight TO movie_similarity_weight;
ALTER TABLE recommendation_config RENAME COLUMN novelty_weight TO movie_novelty_weight;
ALTER TABLE recommendation_config RENAME COLUMN rating_weight TO movie_rating_weight;
ALTER TABLE recommendation_config RENAME COLUMN diversity_weight TO movie_diversity_weight;

-- Add series-specific weight columns (series_selected_count and series_recent_watch_limit already exist from 0039)
ALTER TABLE recommendation_config 
  ADD COLUMN series_max_candidates INTEGER NOT NULL DEFAULT 50000,
  ADD COLUMN series_similarity_weight NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  ADD COLUMN series_novelty_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  ADD COLUMN series_rating_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  ADD COLUMN series_diversity_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20;

-- Update comments
COMMENT ON COLUMN recommendation_config.movie_max_candidates IS 'Maximum movies to consider as candidates';
COMMENT ON COLUMN recommendation_config.movie_selected_count IS 'Number of movie recommendations per user';
COMMENT ON COLUMN recommendation_config.movie_recent_watch_limit IS 'Number of recent movie watches used for taste profile';
COMMENT ON COLUMN recommendation_config.movie_similarity_weight IS 'Movie taste similarity weight (0-1)';
COMMENT ON COLUMN recommendation_config.movie_novelty_weight IS 'Movie genre discovery weight (0-1)';
COMMENT ON COLUMN recommendation_config.movie_rating_weight IS 'Movie community rating weight (0-1)';
COMMENT ON COLUMN recommendation_config.movie_diversity_weight IS 'Movie result diversity weight (0-1)';

COMMENT ON COLUMN recommendation_config.series_max_candidates IS 'Maximum series to consider as candidates';
COMMENT ON COLUMN recommendation_config.series_selected_count IS 'Number of series recommendations per user';
COMMENT ON COLUMN recommendation_config.series_recent_watch_limit IS 'Number of watched episodes used for taste profile';
COMMENT ON COLUMN recommendation_config.series_similarity_weight IS 'Series taste similarity weight (0-1)';
COMMENT ON COLUMN recommendation_config.series_novelty_weight IS 'Series genre discovery weight (0-1)';
COMMENT ON COLUMN recommendation_config.series_rating_weight IS 'Series community rating weight (0-1)';
COMMENT ON COLUMN recommendation_config.series_diversity_weight IS 'Series result diversity weight (0-1)';


