-- Migration: 0039_recommendation_config_series
-- Description: Add series-specific settings to recommendation_config

ALTER TABLE recommendation_config 
  ADD COLUMN series_selected_count INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN series_recent_watch_limit INTEGER NOT NULL DEFAULT 100;

COMMENT ON COLUMN recommendation_config.series_selected_count IS 'Number of series recommendations per user';
COMMENT ON COLUMN recommendation_config.series_recent_watch_limit IS 'Number of watched episodes used to build series taste profile';

