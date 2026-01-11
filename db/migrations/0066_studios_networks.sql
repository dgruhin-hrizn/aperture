-- Migration: 0066_studios_networks
-- Description: Create studios_networks table for caching TMDB production company and network data with logos

-- Studios/Networks table for caching TMDB data and logos
CREATE TABLE studios_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Identification
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('studio', 'network')),
  
  -- External IDs
  emby_id TEXT,                    -- Emby/Jellyfin studio ID
  tmdb_id INTEGER,                 -- TMDB company/network ID
  
  -- TMDB metadata
  logo_path TEXT,                  -- TMDB logo path (e.g., /logo.png)
  origin_country TEXT,
  
  -- Local storage
  logo_local_path TEXT,            -- Path to downloaded logo
  
  -- Sync status
  emby_synced_at TIMESTAMPTZ,      -- When logo was pushed to Emby
  
  UNIQUE(name, type)
);

-- Indexes for common lookups
CREATE INDEX idx_studios_networks_name ON studios_networks(name);
CREATE INDEX idx_studios_networks_type ON studios_networks(type);
CREATE INDEX idx_studios_networks_tmdb_id ON studios_networks(tmdb_id);
CREATE INDEX idx_studios_networks_emby_id ON studios_networks(emby_id);
CREATE INDEX idx_studios_networks_logo_path ON studios_networks(logo_path) WHERE logo_path IS NULL;

-- Apply updated_at trigger
CREATE TRIGGER trigger_studios_networks_updated_at
  BEFORE UPDATE ON studios_networks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Configuration setting for Emby push
INSERT INTO system_settings (key, value)
VALUES ('studio_logos_push_to_emby', 'false')
ON CONFLICT (key) DO NOTHING;

-- Add job config for the enrichment job
INSERT INTO job_config (job_name, schedule_type, schedule_hour, schedule_minute, is_enabled)
VALUES ('enrich-studio-logos', 'daily', 5, 0, true)
ON CONFLICT (job_name) DO NOTHING;

COMMENT ON TABLE studios_networks IS 'Cache of production studios and TV networks with TMDB metadata and logos';
COMMENT ON COLUMN studios_networks.name IS 'Studio/network name';
COMMENT ON COLUMN studios_networks.type IS 'Type: studio (movies) or network (TV)';
COMMENT ON COLUMN studios_networks.emby_id IS 'Emby/Jellyfin studio item ID for image push';
COMMENT ON COLUMN studios_networks.tmdb_id IS 'TMDB company or network ID';
COMMENT ON COLUMN studios_networks.logo_path IS 'TMDB logo path (e.g., /logo.png)';
COMMENT ON COLUMN studios_networks.logo_local_path IS 'Local path to downloaded logo file';
COMMENT ON COLUMN studios_networks.emby_synced_at IS 'Timestamp when logo was last pushed to Emby';

