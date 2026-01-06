-- Migration: 0047_separate_symlink_settings
-- Description: Replace single use_symlinks with separate movies/series toggles (both default to STRM/false)

-- Add separate symlink settings for movies and series
ALTER TABLE top_picks_config 
  ADD COLUMN IF NOT EXISTS movies_use_symlinks BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS series_use_symlinks BOOLEAN DEFAULT false;

COMMENT ON COLUMN top_picks_config.movies_use_symlinks IS 'Use symlinks instead of STRM files for Movies library (requires shared filesystem paths)';
COMMENT ON COLUMN top_picks_config.series_use_symlinks IS 'Use symlinks instead of STRM files for Series library (requires shared filesystem paths)';

-- Migrate existing use_symlinks value to series (since that was the only one actually using it)
UPDATE top_picks_config 
SET series_use_symlinks = use_symlinks 
WHERE use_symlinks IS NOT NULL;

-- Drop the old column (keeping it won't hurt but clean is better)
-- Note: Not dropping in case of rollback needs - can be done in a future cleanup migration


