-- Migration: 0017_include_watched_preference
-- Description: Add include_watched column to user_preferences for controlling
--              whether recommendations should include previously watched movies

-- Add the include_watched column with default to false (exclude watched)
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS include_watched BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN user_preferences.include_watched IS 'Whether to include previously watched movies in recommendations (useful for rewatching favorites)';



