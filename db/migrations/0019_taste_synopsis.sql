-- Migration: 0019_taste_synopsis
-- Description: Add AI-generated taste synopsis for users

-- Add taste synopsis column to user_preferences
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS taste_synopsis TEXT,
ADD COLUMN IF NOT EXISTS taste_synopsis_updated_at TIMESTAMPTZ;

-- Add index for finding stale synopses
CREATE INDEX IF NOT EXISTS idx_user_preferences_synopsis_updated 
ON user_preferences(taste_synopsis_updated_at) 
WHERE taste_synopsis IS NOT NULL;

COMMENT ON COLUMN user_preferences.taste_synopsis IS 'AI-generated natural language summary of user movie taste';
COMMENT ON COLUMN user_preferences.taste_synopsis_updated_at IS 'When the taste synopsis was last regenerated';



