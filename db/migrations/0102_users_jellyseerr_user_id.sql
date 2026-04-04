-- Migration: 0102_users_jellyseerr_user_id
-- Description: Map Aperture users to Seerr numeric user ids for attributed requests

ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyseerr_user_id INTEGER NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_jellyseerr_user_id_unique
  ON users (jellyseerr_user_id)
  WHERE jellyseerr_user_id IS NOT NULL;

COMMENT ON COLUMN users.jellyseerr_user_id IS 'Seerr API user id for POST /request userId; resolved by email/username/Jellyfin id match or set by admin';
