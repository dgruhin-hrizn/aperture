-- Migration: 0022_expanded_movie_metadata
-- Description: Add comprehensive metadata fields from Emby/Jellyfin

-- Tagline
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tagline TEXT;

-- MPAA/Content Rating (PG-13, R, etc.)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS content_rating TEXT;

-- Premiere/Release Date (more precise than year)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS premiere_date DATE;

-- Studios (array)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS studios TEXT[] DEFAULT '{}';

-- Directors (array of names)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS directors TEXT[] DEFAULT '{}';

-- Writers (array of names)  
ALTER TABLE movies ADD COLUMN IF NOT EXISTS writers TEXT[] DEFAULT '{}';

-- Cast/Actors (JSONB array with name, role, thumb)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS actors JSONB DEFAULT '[]'::JSONB;

-- External IDs (IMDB, TMDB, etc.)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS imdb_id TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tmdb_id TEXT;

-- Tags (user-defined tags from Emby)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Sort title (for proper alphabetical sorting)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS sort_title TEXT;

-- Production countries
ALTER TABLE movies ADD COLUMN IF NOT EXISTS production_countries TEXT[] DEFAULT '{}';

-- Awards text
ALTER TABLE movies ADD COLUMN IF NOT EXISTS awards TEXT;

-- Video quality info
ALTER TABLE movies ADD COLUMN IF NOT EXISTS video_resolution TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS video_codec TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS audio_codec TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS container TEXT;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_movies_content_rating ON movies(content_rating);
CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_directors ON movies USING GIN(directors);
CREATE INDEX IF NOT EXISTS idx_movies_studios ON movies USING GIN(studios);

COMMENT ON COLUMN movies.tagline IS 'Movie tagline/slogan';
COMMENT ON COLUMN movies.content_rating IS 'MPAA or content rating (PG-13, R, TV-MA, etc.)';
COMMENT ON COLUMN movies.premiere_date IS 'Premiere/release date';
COMMENT ON COLUMN movies.studios IS 'Production studios';
COMMENT ON COLUMN movies.directors IS 'Director names';
COMMENT ON COLUMN movies.writers IS 'Writer/screenplay credits';
COMMENT ON COLUMN movies.actors IS 'Cast with name, role, and thumbnail URL';
COMMENT ON COLUMN movies.imdb_id IS 'IMDB ID (tt1234567)';
COMMENT ON COLUMN movies.tmdb_id IS 'TheMovieDB ID';
COMMENT ON COLUMN movies.tags IS 'User-defined tags from media server';
COMMENT ON COLUMN movies.sort_title IS 'Title used for sorting (ignores articles like The, A)';

