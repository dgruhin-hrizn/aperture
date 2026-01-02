-- Library configuration for movie sync
-- Stores which media server libraries should be included when syncing movies

CREATE TABLE IF NOT EXISTS library_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_library_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  collection_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_library_config_enabled ON library_config(is_enabled) WHERE is_enabled = true;

-- Add trigger for updated_at
CREATE TRIGGER set_library_config_updated_at
  BEFORE UPDATE ON library_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE library_config IS 'Stores media server library configuration for sync filtering';
COMMENT ON COLUMN library_config.provider_library_id IS 'The library ID from Emby/Jellyfin';
COMMENT ON COLUMN library_config.is_enabled IS 'Whether this library should be included in movie sync';

