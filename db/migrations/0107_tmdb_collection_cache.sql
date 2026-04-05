-- Migration: 0107_tmdb_collection_cache
-- Description: Local cache of TMDb collection details + parts for gap analysis (avoids repeated API calls on page load)

CREATE TABLE tmdb_collection_cache (
  collection_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  parts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tmdb_collection_cache_updated_at ON tmdb_collection_cache(updated_at DESC);

COMMENT ON TABLE tmdb_collection_cache IS 'TMDb collection details and parts; populated by gap analysis / enrichment; used for gap UI without per-collection API calls';
