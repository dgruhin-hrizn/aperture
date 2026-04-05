-- Migration: 0103_jellyseerr_require_user_mapping
-- When true, POST /api/seerr/request requires a linked Seerr user after migration 0104 (or returns 422).

INSERT INTO system_settings (key, value, description)
VALUES (
  'jellyseerr_require_user_mapping',
  'false',
  'If true, content requests fail until the user is matched or manually mapped to a Seerr user id'
)
ON CONFLICT (key) DO NOTHING;
