-- Migration: 0081_discovery_imdb_id
-- Description: Add IMDb ID to discovery candidates for direct IMDb links

ALTER TABLE discovery_candidates ADD COLUMN imdb_id TEXT;

CREATE INDEX idx_discovery_candidates_imdb_id ON discovery_candidates(imdb_id) WHERE imdb_id IS NOT NULL;

COMMENT ON COLUMN discovery_candidates.imdb_id IS 'IMDb ID for direct linking (e.g., tt1234567)';

