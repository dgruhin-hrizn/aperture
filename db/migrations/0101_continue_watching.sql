-- Continue Watching feature
-- Stores deduplicated "Continue Watching" items per user from Emby/Jellyfin Resume API
-- Filters out Aperture-created libraries and admin-excluded libraries

-- Add 'continue-watching' to strm_libraries library_type check constraint
ALTER TABLE strm_libraries DROP CONSTRAINT IF EXISTS strm_libraries_library_type_check;
ALTER TABLE strm_libraries ADD CONSTRAINT strm_libraries_library_type_check 
  CHECK (library_type = ANY (ARRAY['ai-recs'::text, 'watching'::text, 'continue-watching'::text]));

-- Table to store deduplicated continue watching items per user
CREATE TABLE IF NOT EXISTS continue_watching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_item_id TEXT NOT NULL,  -- Original Emby/Jellyfin item ID (from real library)
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'episode')),
  title TEXT NOT NULL,
  tmdb_id TEXT,
  imdb_id TEXT,
  progress_percent NUMERIC(5,2),
  playback_position_ticks BIGINT,
  runtime_ticks BIGINT,
  last_played_at TIMESTAMPTZ,
  source_library_id TEXT NOT NULL,  -- Which library this item is from
  source_library_name TEXT,  -- Library name for display/debugging
  -- Episode-specific fields
  series_id TEXT,
  series_name TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider_item_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_continue_watching_user_id ON continue_watching(user_id);
CREATE INDEX IF NOT EXISTS idx_continue_watching_media_type ON continue_watching(user_id, media_type);
CREATE INDEX IF NOT EXISTS idx_continue_watching_last_played ON continue_watching(user_id, last_played_at DESC);
CREATE INDEX IF NOT EXISTS idx_continue_watching_tmdb ON continue_watching(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_continue_watching_imdb ON continue_watching(imdb_id) WHERE imdb_id IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER trigger_continue_watching_updated_at
  BEFORE UPDATE ON continue_watching
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Configuration table for Continue Watching settings
CREATE TABLE IF NOT EXISTS continue_watching_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  use_symlinks BOOLEAN NOT NULL DEFAULT false,
  library_name TEXT NOT NULL DEFAULT '{{username}}''s Continue Watching',
  poll_interval_seconds INTEGER NOT NULL DEFAULT 60,
  excluded_library_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to update updated_at for config
CREATE TRIGGER trigger_continue_watching_config_updated_at
  BEFORE UPDATE ON continue_watching_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default config row (singleton pattern)
INSERT INTO continue_watching_config (enabled, use_symlinks, library_name, poll_interval_seconds, excluded_library_ids)
VALUES (false, false, '{{username}}''s Continue Watching', 60, '{}')
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE continue_watching IS 'Deduplicated Continue Watching items per user from Emby/Jellyfin Resume API';
COMMENT ON COLUMN continue_watching.provider_item_id IS 'Original Emby/Jellyfin item ID from the real library';
COMMENT ON COLUMN continue_watching.source_library_id IS 'The library ID this item belongs to in Emby/Jellyfin';
COMMENT ON COLUMN continue_watching.progress_percent IS 'Playback progress as percentage (0-100)';

COMMENT ON TABLE continue_watching_config IS 'Singleton config for Continue Watching feature';
COMMENT ON COLUMN continue_watching_config.library_name IS 'Template with merge tags: {{username}}, {{userid}}';
COMMENT ON COLUMN continue_watching_config.excluded_library_ids IS 'Library IDs to exclude (e.g., Movies 4K to avoid duplicates)';
