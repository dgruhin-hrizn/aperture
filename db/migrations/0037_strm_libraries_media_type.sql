-- Migration: 0037_strm_libraries_media_type
-- Description: Add media type to strm_libraries to distinguish movie vs series libraries

ALTER TABLE strm_libraries ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movies'
  CHECK (media_type IN ('movies', 'series'));

CREATE INDEX idx_strm_libraries_media_type ON strm_libraries(user_id, media_type);

COMMENT ON COLUMN strm_libraries.media_type IS 'Type of library: movies or series';


