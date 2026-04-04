-- Cache TMDb person lookups (profile image + combined credits) by normalized name key.
-- name_key: lower(trim(name)); collisions for identical strings are accepted per product note.

CREATE TABLE IF NOT EXISTS person_tmdb_profile_cache (
  name_key TEXT PRIMARY KEY,
  tmdb_person_id INTEGER,
  profile_path TEXT,
  not_found BOOLEAN NOT NULL DEFAULT FALSE,
  combined_credits_json JSONB,
  combined_credits_cached_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_tmdb_profile_cache_updated
  ON person_tmdb_profile_cache (updated_at DESC);

COMMENT ON TABLE person_tmdb_profile_cache IS 'TMDb person id/profile_path and optional combined credits cache keyed by normalized person name';
COMMENT ON COLUMN person_tmdb_profile_cache.not_found IS 'True when TMDb search returned no person';
COMMENT ON COLUMN person_tmdb_profile_cache.combined_credits_json IS 'Raw TMDb combined_credits response; refreshed on TTL';
