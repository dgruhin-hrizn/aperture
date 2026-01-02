-- Migration: 0011_strm_libraries
-- Description: Create strm_libraries table for tracking created virtual libraries

CREATE TABLE strm_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Owner (can be null for system-level libraries)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Channel reference (null for user's main AI Picks library)
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,

  -- Library details
  name TEXT NOT NULL,
  path TEXT NOT NULL, -- Filesystem path where STRM files are written

  -- Media server library ID
  provider_library_id TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  file_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_strm_libraries_user_id ON strm_libraries(user_id);
CREATE INDEX idx_strm_libraries_channel_id ON strm_libraries(channel_id);
CREATE INDEX idx_strm_libraries_path ON strm_libraries(path);

-- Apply updated_at trigger
CREATE TRIGGER trigger_strm_libraries_updated_at
  BEFORE UPDATE ON strm_libraries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE strm_libraries IS 'Virtual STRM libraries created in the media server';
COMMENT ON COLUMN strm_libraries.path IS 'Filesystem path where STRM files are written';
COMMENT ON COLUMN strm_libraries.provider_library_id IS 'Library ID in the media server';

