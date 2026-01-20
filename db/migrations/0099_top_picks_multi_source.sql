-- Top Picks Multi-Source Configuration
-- Expands popularity sources to include TMDB options and improves hybrid mode

-- Step 1: Update movies_popularity_source to support new values
-- Valid values: 'emby_history', 'tmdb_popular', 'tmdb_trending_day', 'tmdb_trending_week', 'tmdb_top_rated', 'mdblist', 'hybrid'
-- Rename 'local' to 'emby_history' for clarity
UPDATE top_picks_config
SET movies_popularity_source = 'emby_history'
WHERE movies_popularity_source = 'local';

UPDATE top_picks_config
SET series_popularity_source = 'emby_history'
WHERE series_popularity_source = 'local';

-- Step 2: Add hybrid_external_source columns for movies and series
-- These specify which external source to blend with local data when hybrid mode is selected
ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS movies_hybrid_external_source TEXT DEFAULT 'tmdb_popular';

ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS series_hybrid_external_source TEXT DEFAULT 'tmdb_popular';

-- Step 3: Rename hybrid weight columns for clarity
-- hybrid_mdblist_weight becomes hybrid_external_weight
ALTER TABLE top_picks_config
  RENAME COLUMN hybrid_mdblist_weight TO hybrid_external_weight;

-- Step 4: Add auto-request configuration for Jellyseerr integration
ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS movies_auto_request_enabled BOOLEAN DEFAULT false;

ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS movies_auto_request_limit INTEGER DEFAULT 10;

ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS series_auto_request_enabled BOOLEAN DEFAULT false;

ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS series_auto_request_limit INTEGER DEFAULT 10;

ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS auto_request_cron TEXT DEFAULT '0 0 * * 0';

-- Add comments for documentation
COMMENT ON COLUMN top_picks_config.movies_popularity_source IS 'Popularity source for movies: emby_history, tmdb_popular, tmdb_trending_day, tmdb_trending_week, tmdb_top_rated, mdblist, or hybrid';
COMMENT ON COLUMN top_picks_config.series_popularity_source IS 'Popularity source for series: emby_history, tmdb_popular, tmdb_trending_day, tmdb_trending_week, tmdb_top_rated, mdblist, or hybrid';
COMMENT ON COLUMN top_picks_config.movies_hybrid_external_source IS 'External source to blend with local data in hybrid mode for movies';
COMMENT ON COLUMN top_picks_config.series_hybrid_external_source IS 'External source to blend with local data in hybrid mode for series';
COMMENT ON COLUMN top_picks_config.hybrid_external_weight IS 'Weight for external source in hybrid mode (0.0-1.0)';
COMMENT ON COLUMN top_picks_config.movies_auto_request_enabled IS 'Enable automatic Jellyseerr requests for missing Top Picks movies';
COMMENT ON COLUMN top_picks_config.movies_auto_request_limit IS 'Maximum number of movie requests per auto-request job run';
COMMENT ON COLUMN top_picks_config.series_auto_request_enabled IS 'Enable automatic Jellyseerr requests for missing Top Picks series';
COMMENT ON COLUMN top_picks_config.series_auto_request_limit IS 'Maximum number of series requests per auto-request job run';
COMMENT ON COLUMN top_picks_config.auto_request_cron IS 'Cron schedule for auto-request job (default: weekly on Sunday at midnight)';
