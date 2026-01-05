-- Migration: 0048_studio_jsonb
-- Description: Convert studios column from TEXT[] to JSONB to store studio IDs for image lookups

-- Step 1: Add new JSONB columns for movies and series
ALTER TABLE movies ADD COLUMN studios_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE series ADD COLUMN studios_new JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data - convert TEXT[] to JSONB array of {name: value}
UPDATE movies 
SET studios_new = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('name', s)) FROM unnest(studios) AS s),
  '[]'::jsonb
)
WHERE studios IS NOT NULL AND array_length(studios, 1) > 0;

UPDATE series 
SET studios_new = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('name', s)) FROM unnest(studios) AS s),
  '[]'::jsonb
)
WHERE studios IS NOT NULL AND array_length(studios, 1) > 0;

-- Step 3: Drop old columns and indexes
DROP INDEX IF EXISTS idx_movies_studios;
DROP INDEX IF EXISTS idx_series_studios;
ALTER TABLE movies DROP COLUMN studios;
ALTER TABLE series DROP COLUMN studios;

-- Step 4: Rename new columns to original names
ALTER TABLE movies RENAME COLUMN studios_new TO studios;
ALTER TABLE series RENAME COLUMN studios_new TO studios;

-- Step 5: Create new GIN indexes for JSONB
CREATE INDEX idx_movies_studios_jsonb ON movies USING GIN(studios);
CREATE INDEX idx_series_studios_jsonb ON series USING GIN(studios);

COMMENT ON COLUMN movies.studios IS 'Production studios with IDs for image lookups (JSONB array of {id, name})';
COMMENT ON COLUMN series.studios IS 'Production studios/networks with IDs for image lookups (JSONB array of {id, name})';
