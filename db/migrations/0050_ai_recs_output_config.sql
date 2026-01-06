-- Migration: 0050_ai_recs_output_config
-- Description: Add separate movies/series output format settings for AI recommendations
--              and update Top Picks series default to use symlinks

-- Remove the old single setting (if it exists)
DELETE FROM system_settings WHERE key = 'user_recs_use_symlinks';

-- Add separate movies/series settings for AI recommendations
-- Movies defaults to STRM (false), Series defaults to Symlinks (true)
INSERT INTO system_settings (key, value, description) VALUES
  ('ai_recs_movies_use_symlinks', 'false', 'Use symlinks instead of STRM files for AI Movies library'),
  ('ai_recs_series_use_symlinks', 'true', 'Use symlinks instead of STRM files for AI Series library')
ON CONFLICT (key) DO NOTHING;

-- Update Top Picks series default to symlinks (TV series work better with symlinks)
UPDATE top_picks_config SET series_use_symlinks = true WHERE series_use_symlinks = false;

COMMENT ON TABLE system_settings IS 'System-wide configuration settings';

