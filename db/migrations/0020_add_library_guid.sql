-- Migration: 0020_add_library_guid
-- Description: Add provider_library_guid column for Emby/Jellyfin user permissions

ALTER TABLE strm_libraries
ADD COLUMN provider_library_guid TEXT;

-- For Emby, the GUID is different from the ItemId and is used for user permissions
COMMENT ON COLUMN strm_libraries.provider_library_guid IS 'Library GUID in media server (used for user permissions)';

