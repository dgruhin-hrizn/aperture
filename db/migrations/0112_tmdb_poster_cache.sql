-- Cache TMDb poster_path by title + language to reduce API calls for streaming discovery (and similar).

CREATE TABLE tmdb_poster_cache (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  poster_path TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (media_type, tmdb_id, language)
);

CREATE INDEX idx_tmdb_poster_cache_fetched_at ON tmdb_poster_cache (fetched_at DESC);

COMMENT ON TABLE tmdb_poster_cache IS 'TMDb poster_path cache; TTL enforced in application (see TMDB_POSTER_CACHE_TTL_MS)';
