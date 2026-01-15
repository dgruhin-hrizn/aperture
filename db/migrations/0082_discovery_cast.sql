-- Migration: 0082_discovery_cast
-- Description: Add cast/crew metadata columns to discovery_candidates for detail popper

ALTER TABLE discovery_candidates 
  ADD COLUMN IF NOT EXISTS cast_members JSONB,
  ADD COLUMN IF NOT EXISTS directors TEXT[],
  ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS tagline TEXT;

COMMENT ON COLUMN discovery_candidates.cast_members IS 'JSON array of cast members: [{id, name, character, profilePath, order}]';
COMMENT ON COLUMN discovery_candidates.directors IS 'Array of director names';
COMMENT ON COLUMN discovery_candidates.runtime_minutes IS 'Runtime in minutes for movies';
COMMENT ON COLUMN discovery_candidates.tagline IS 'Movie/series tagline';

