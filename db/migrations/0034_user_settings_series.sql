-- Migration: 0034_user_settings_series
-- Description: Add series library name to user_settings

ALTER TABLE user_settings ADD COLUMN series_library_name TEXT;

COMMENT ON COLUMN user_settings.series_library_name IS 'Custom name for the AI TV recommendations library in media server';



