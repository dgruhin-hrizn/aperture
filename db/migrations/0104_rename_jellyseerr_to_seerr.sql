-- Migration: 0104_rename_jellyseerr_to_seerr
-- Renames jellyseerr_* DB identifiers and system_settings keys to seerr_* (terminology alignment).

-- users.jellyseerr_user_id -> seerr_user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'jellyseerr_user_id'
  ) THEN
    DROP INDEX IF EXISTS idx_users_jellyseerr_user_id_unique;
    ALTER TABLE users RENAME COLUMN jellyseerr_user_id TO seerr_user_id;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_seerr_user_id_unique
      ON users (seerr_user_id)
      WHERE seerr_user_id IS NOT NULL;
    COMMENT ON COLUMN users.seerr_user_id IS 'Seerr API user id for POST /request userId; resolved by email/username/Jellyfin id match or set by admin';
  END IF;
END $$;

-- discovery_requests jellyseerr_* -> seerr_*
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovery_requests' AND column_name = 'jellyseerr_request_id'
  ) THEN
    ALTER TABLE discovery_requests RENAME COLUMN jellyseerr_request_id TO seerr_request_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discovery_requests' AND column_name = 'jellyseerr_media_id'
  ) THEN
    ALTER TABLE discovery_requests RENAME COLUMN jellyseerr_media_id TO seerr_media_id;
  END IF;
END $$;

COMMENT ON COLUMN discovery_requests.seerr_request_id IS 'Request ID in Seerr';
COMMENT ON COLUMN discovery_requests.seerr_media_id IS 'Media ID in Seerr';

-- system_settings keys
UPDATE system_settings SET key = 'seerr_url' WHERE key = 'jellyseerr_url';
UPDATE system_settings SET key = 'seerr_api_key' WHERE key = 'jellyseerr_api_key';
UPDATE system_settings SET key = 'seerr_enabled' WHERE key = 'jellyseerr_enabled';
UPDATE system_settings SET key = 'seerr_require_user_mapping' WHERE key = 'jellyseerr_require_user_mapping';
