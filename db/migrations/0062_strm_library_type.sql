-- Migration: 0062_strm_library_type
-- Description: Add library_type column to strm_libraries for watching libraries

ALTER TABLE strm_libraries ADD COLUMN library_type TEXT NOT NULL DEFAULT 'ai-recs'
  CHECK (library_type IN ('ai-recs', 'watching'));

CREATE INDEX idx_strm_libraries_type ON strm_libraries(user_id, library_type);

COMMENT ON COLUMN strm_libraries.library_type IS 'Type of library: ai-recs or watching';



