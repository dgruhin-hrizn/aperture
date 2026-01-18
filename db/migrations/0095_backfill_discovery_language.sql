-- Backfill original_language for discovery_candidates
-- 
-- Note: The library tables (movies, series) store languages as a text[] array
-- rather than a single original_language field. This migration attempts to
-- extract the first language from the array as a reasonable default.
--
-- For complete language data, users should click "Refresh" in the Discovery
-- page, which will re-generate candidates with proper TMDb enrichment.

-- For movies: use the first language in the languages array
UPDATE discovery_candidates dc
SET original_language = m.languages[1]
FROM movies m
WHERE dc.tmdb_id::text = m.tmdb_id
  AND dc.media_type = 'movie'
  AND dc.original_language IS NULL
  AND array_length(m.languages, 1) > 0;

-- For series: use the first language in the languages array
UPDATE discovery_candidates dc
SET original_language = s.languages[1]
FROM series s
WHERE dc.tmdb_id::text = s.tmdb_id
  AND dc.media_type = 'series'
  AND dc.original_language IS NULL
  AND array_length(s.languages, 1) > 0;
