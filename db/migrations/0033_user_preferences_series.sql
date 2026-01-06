-- Migration: 0033_user_preferences_series
-- Description: Add series taste profile fields to user_preferences

-- Add series taste embedding (same dimensions as movie taste embedding)
ALTER TABLE user_preferences ADD COLUMN series_taste_embedding halfvec(3072);
ALTER TABLE user_preferences ADD COLUMN series_taste_embedding_updated_at TIMESTAMPTZ;

-- Add series taste synopsis
ALTER TABLE user_preferences ADD COLUMN series_taste_synopsis TEXT;
ALTER TABLE user_preferences ADD COLUMN series_taste_synopsis_updated_at TIMESTAMPTZ;

-- Add index for finding stale series synopses
CREATE INDEX IF NOT EXISTS idx_user_preferences_series_synopsis_updated 
  ON user_preferences(series_taste_synopsis_updated_at) 
  WHERE series_taste_synopsis IS NOT NULL;

COMMENT ON COLUMN user_preferences.series_taste_embedding IS 'Computed embedding representing user TV series taste';
COMMENT ON COLUMN user_preferences.series_taste_synopsis IS 'AI-generated natural language summary of user TV series taste';


