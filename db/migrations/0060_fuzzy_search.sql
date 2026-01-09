-- Migration: 0060_fuzzy_search
-- Description: Add full-text search vectors and trigram indexes for unified fuzzy search

-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add tsvector columns to movies table
ALTER TABLE movies ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add tsvector columns to series table
ALTER TABLE series ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to generate search vector for movies
CREATE OR REPLACE FUNCTION movies_search_vector(
  p_title TEXT,
  p_original_title TEXT,
  p_overview TEXT,
  p_genres TEXT[],
  p_directors TEXT[],
  p_writers TEXT[],
  p_actors JSONB,
  p_keywords TEXT[],
  p_collection_name TEXT
) RETURNS tsvector AS $$
BEGIN
  RETURN
    setweight(to_tsvector('english', COALESCE(p_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p_original_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p_collection_name, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_genres, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_keywords, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_directors, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_writers, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(actor->>'name', ' ') FROM jsonb_array_elements(COALESCE(p_actors, '[]'::jsonb)) AS actor),
      ''
    )), 'C') ||
    setweight(to_tsvector('english', COALESCE(p_overview, '')), 'D');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to generate search vector for series
CREATE OR REPLACE FUNCTION series_search_vector(
  p_title TEXT,
  p_original_title TEXT,
  p_overview TEXT,
  p_genres TEXT[],
  p_network TEXT,
  p_directors TEXT[],
  p_writers TEXT[],
  p_actors JSONB,
  p_keywords TEXT[]
) RETURNS tsvector AS $$
BEGIN
  RETURN
    setweight(to_tsvector('english', COALESCE(p_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p_original_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p_network, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_genres, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_keywords, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_directors, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(p_writers, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(actor->>'name', ' ') FROM jsonb_array_elements(COALESCE(p_actors, '[]'::jsonb)) AS actor),
      ''
    )), 'C') ||
    setweight(to_tsvector('english', COALESCE(p_overview, '')), 'D');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate search vectors for existing movies
UPDATE movies SET search_vector = movies_search_vector(
  title, original_title, overview, genres, directors, writers, actors, keywords, collection_name
);

-- Populate search vectors for existing series
UPDATE series SET search_vector = series_search_vector(
  title, original_title, overview, genres, network, directors, writers, actors, keywords
);

-- Create GIN index for full-text search on movies
CREATE INDEX IF NOT EXISTS idx_movies_search_vector ON movies USING GIN(search_vector);

-- Create GIN index for full-text search on series
CREATE INDEX IF NOT EXISTS idx_series_search_vector ON series USING GIN(search_vector);

-- Create trigram indexes for fuzzy matching on titles (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_movies_original_title_trgm ON movies USING GIN(original_title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_series_title_trgm ON series USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_series_original_title_trgm ON series USING GIN(original_title gin_trgm_ops);

-- Create trigger function to update search vector on movie insert/update
CREATE OR REPLACE FUNCTION update_movies_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := movies_search_vector(
    NEW.title, NEW.original_title, NEW.overview, NEW.genres, 
    NEW.directors, NEW.writers, NEW.actors, NEW.keywords, NEW.collection_name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update search vector on series insert/update
CREATE OR REPLACE FUNCTION update_series_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := series_search_vector(
    NEW.title, NEW.original_title, NEW.overview, NEW.genres, 
    NEW.network, NEW.directors, NEW.writers, NEW.actors, NEW.keywords
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_movies_search_vector ON movies;
CREATE TRIGGER trigger_movies_search_vector
  BEFORE INSERT OR UPDATE ON movies
  FOR EACH ROW
  EXECUTE FUNCTION update_movies_search_vector();

DROP TRIGGER IF EXISTS trigger_series_search_vector ON series;
CREATE TRIGGER trigger_series_search_vector
  BEFORE INSERT OR UPDATE ON series
  FOR EACH ROW
  EXECUTE FUNCTION update_series_search_vector();

