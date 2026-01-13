-- Split Top Picks settings into movie-specific and series-specific
-- This allows users to configure different sources, time windows, and thresholds for movies vs series

-- Step 1: Rename existing shared columns to movies-specific
ALTER TABLE top_picks_config
  RENAME COLUMN popularity_source TO movies_popularity_source;

ALTER TABLE top_picks_config
  RENAME COLUMN min_unique_viewers TO movies_min_unique_viewers;

ALTER TABLE top_picks_config
  RENAME COLUMN time_window_days TO movies_time_window_days;

-- Step 2: Add movies_use_all_matches column
ALTER TABLE top_picks_config
  ADD COLUMN movies_use_all_matches BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Add series-specific columns (copy current values as defaults)
ALTER TABLE top_picks_config
  ADD COLUMN series_popularity_source TEXT NOT NULL DEFAULT 'local';

ALTER TABLE top_picks_config
  ADD COLUMN series_min_unique_viewers INTEGER NOT NULL DEFAULT 1;

ALTER TABLE top_picks_config
  ADD COLUMN series_time_window_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE top_picks_config
  ADD COLUMN series_use_all_matches BOOLEAN NOT NULL DEFAULT false;

-- Step 4: Copy current movies values to series columns so they start with same settings
UPDATE top_picks_config
SET
  series_popularity_source = movies_popularity_source,
  series_min_unique_viewers = movies_min_unique_viewers,
  series_time_window_days = movies_time_window_days
WHERE id = 1;

-- Add comments for documentation
COMMENT ON COLUMN top_picks_config.movies_popularity_source IS 'Popularity source for movies: local, mdblist, or hybrid';
COMMENT ON COLUMN top_picks_config.movies_min_unique_viewers IS 'Minimum unique viewers required for a movie to be included (Local/Hybrid mode)';
COMMENT ON COLUMN top_picks_config.movies_time_window_days IS 'Time window in days for calculating movie popularity (Local/Hybrid mode)';
COMMENT ON COLUMN top_picks_config.movies_use_all_matches IS 'If true, include all matching movies instead of limiting to movies_count';
COMMENT ON COLUMN top_picks_config.series_popularity_source IS 'Popularity source for series: local, mdblist, or hybrid';
COMMENT ON COLUMN top_picks_config.series_min_unique_viewers IS 'Minimum unique viewers required for a series to be included (Local/Hybrid mode)';
COMMENT ON COLUMN top_picks_config.series_time_window_days IS 'Time window in days for calculating series popularity (Local/Hybrid mode)';
COMMENT ON COLUMN top_picks_config.series_use_all_matches IS 'If true, include all matching series instead of limiting to series_count';

