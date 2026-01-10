-- Media server settings stored in system_settings table
-- These settings can be configured in the UI instead of environment variables

-- Note: We use the existing system_settings table created in 0023_embedding_model_setting.sql
-- The settings will be:
--   media_server_type: 'emby' or 'jellyfin'
--   media_server_base_url: The base URL of the media server
--   media_server_api_key: The API key for authentication

-- No schema changes needed - just documenting that these keys will be used:
-- INSERT INTO system_settings (key, value, description) VALUES
--   ('media_server_type', 'emby', 'Media server type: emby or jellyfin'),
--   ('media_server_base_url', '', 'Media server base URL'),
--   ('media_server_api_key', '', 'Media server API key')
-- These will be inserted when the user configures them in the UI



