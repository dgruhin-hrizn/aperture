-- Migration: 0046_output_config
-- Description: Add output format configuration (STRM/Symlinks), Top Picks output modes, 
--              and AI explanation toggle settings

-- ============================================================================
-- TOP PICKS OUTPUT CONFIGURATION
-- ============================================================================

-- Add output format settings to top_picks_config
ALTER TABLE top_picks_config 
  ADD COLUMN IF NOT EXISTS use_symlinks BOOLEAN DEFAULT false;

-- Movies output modes (any combination can be enabled)
ALTER TABLE top_picks_config 
  ADD COLUMN IF NOT EXISTS movies_library_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS movies_collection_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS movies_playlist_enabled BOOLEAN DEFAULT false;

-- Series output modes (any combination can be enabled)
ALTER TABLE top_picks_config 
  ADD COLUMN IF NOT EXISTS series_library_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS series_collection_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS series_playlist_enabled BOOLEAN DEFAULT false;

-- Collection/Playlist names (separate from library names)
ALTER TABLE top_picks_config
  ADD COLUMN IF NOT EXISTS movies_collection_name TEXT DEFAULT 'Top Picks - Movies',
  ADD COLUMN IF NOT EXISTS series_collection_name TEXT DEFAULT 'Top Picks - Series';

COMMENT ON COLUMN top_picks_config.use_symlinks IS 'Use symlinks instead of STRM files (requires shared filesystem paths)';
COMMENT ON COLUMN top_picks_config.movies_library_enabled IS 'Create a virtual library for Top Picks Movies';
COMMENT ON COLUMN top_picks_config.movies_collection_enabled IS 'Create a Box Set collection for Top Picks Movies';
COMMENT ON COLUMN top_picks_config.movies_playlist_enabled IS 'Create a Playlist for Top Picks Movies';
COMMENT ON COLUMN top_picks_config.series_library_enabled IS 'Create a virtual library for Top Picks Series';
COMMENT ON COLUMN top_picks_config.series_collection_enabled IS 'Create a Box Set collection for Top Picks Series';
COMMENT ON COLUMN top_picks_config.series_playlist_enabled IS 'Create a Playlist for Top Picks Series';

-- ============================================================================
-- USER RECOMMENDATIONS OUTPUT CONFIGURATION
-- ============================================================================

-- User recommendations output format (system setting)
INSERT INTO system_settings (key, value, description)
VALUES (
  'user_recs_use_symlinks',
  'false',
  'Use symlinks instead of STRM files for user recommendations (requires shared filesystem paths)'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- AI EXPLANATION TOGGLE SETTINGS
-- ============================================================================

-- Global AI explanation settings (system settings)
INSERT INTO system_settings (key, value, description)
VALUES (
  'ai_explanation_enabled',
  'true',
  'Include AI-generated explanation of why media was recommended in NFO plot field'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES (
  'ai_explanation_user_override_allowed',
  'false',
  'Allow administrators to grant individual users the ability to toggle AI explanations'
)
ON CONFLICT (key) DO NOTHING;

-- Per-user AI explanation settings
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_explanation_override_allowed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_explanation_enabled BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN users.ai_explanation_override_allowed IS 'Admin-controlled: whether this user can override the global AI explanation setting';
COMMENT ON COLUMN users.ai_explanation_enabled IS 'User preference for AI explanations (NULL = use global default, only used if override_allowed is true)';




