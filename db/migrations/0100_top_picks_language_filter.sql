-- Add language filter settings to top_picks_config
-- Allows filtering Top Picks lists by original language

-- Add language filter columns for movies and series
ALTER TABLE top_picks_config 
ADD COLUMN IF NOT EXISTS movies_languages text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS movies_include_unknown_language boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS series_languages text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS series_include_unknown_language boolean DEFAULT true;

-- Add comment explaining the columns
COMMENT ON COLUMN top_picks_config.movies_languages IS 'ISO 639-1 language codes to include for movies (empty = all languages)';
COMMENT ON COLUMN top_picks_config.movies_include_unknown_language IS 'Include movies with unknown/NULL language when filtering';
COMMENT ON COLUMN top_picks_config.series_languages IS 'ISO 639-1 language codes to include for series (empty = all languages)';
COMMENT ON COLUMN top_picks_config.series_include_unknown_language IS 'Include series with unknown/NULL language when filtering';
