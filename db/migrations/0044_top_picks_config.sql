-- Top Picks Libraries Configuration
-- Adds configuration for global Top Picks libraries and watch history sync timestamps

-- Add sync timestamps to users table for delta sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS watch_history_synced_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS series_watch_history_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN users.watch_history_synced_at IS 'Timestamp of last movie watch history sync for this user (used for delta sync)';
COMMENT ON COLUMN users.series_watch_history_synced_at IS 'Timestamp of last series watch history sync for this user (used for delta sync)';

-- Top Picks configuration table (singleton pattern)
CREATE TABLE IF NOT EXISTS top_picks_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled BOOLEAN DEFAULT false,
  time_window_days INTEGER DEFAULT 30,
  movies_count INTEGER DEFAULT 10,
  series_count INTEGER DEFAULT 10,
  -- Popularity weights (should sum to 1.0)
  unique_viewers_weight NUMERIC(3,2) DEFAULT 0.50,
  play_count_weight NUMERIC(3,2) DEFAULT 0.30,
  completion_weight NUMERIC(3,2) DEFAULT 0.20,
  -- Refresh schedule
  refresh_cron TEXT DEFAULT '0 6 * * *',
  last_refreshed_at TIMESTAMPTZ,
  -- Library names
  movies_library_name TEXT DEFAULT 'Top Picks - Movies',
  series_library_name TEXT DEFAULT 'Top Picks - Series',
  -- Minimum viewers threshold
  min_unique_viewers INTEGER DEFAULT 2,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config if not exists
INSERT INTO top_picks_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE top_picks_config IS 'Configuration for global Top Picks libraries based on aggregated watch history';
COMMENT ON COLUMN top_picks_config.time_window_days IS 'Number of days to look back for popularity calculation';
COMMENT ON COLUMN top_picks_config.unique_viewers_weight IS 'Weight for unique viewers in popularity score (0.00-1.00)';
COMMENT ON COLUMN top_picks_config.play_count_weight IS 'Weight for total play count in popularity score (0.00-1.00)';
COMMENT ON COLUMN top_picks_config.completion_weight IS 'Weight for completion rate in popularity score (0.00-1.00)';
COMMENT ON COLUMN top_picks_config.min_unique_viewers IS 'Minimum number of unique viewers required to appear in Top Picks';



