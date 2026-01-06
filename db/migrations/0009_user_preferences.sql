-- Migration: 0009_user_preferences
-- Description: Create user_preferences table for storing user taste profiles

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reference to user (one preferences record per user)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Computed taste profile embedding (weighted average of watched movies)
  taste_embedding vector(1536),
  taste_embedding_updated_at TIMESTAMPTZ,

  -- User-specified preferences
  preferred_genres TEXT[] DEFAULT '{}',
  excluded_genres TEXT[] DEFAULT '{}',

  -- Recommendation settings
  novelty_weight NUMERIC(3, 2) DEFAULT 0.3, -- How much to weight new genres
  rating_weight NUMERIC(3, 2) DEFAULT 0.2,  -- How much to weight ratings

  -- Additional preferences as JSON
  settings JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Index for looking up preferences by user
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Apply updated_at trigger
CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_preferences IS 'User taste profiles and recommendation preferences';
COMMENT ON COLUMN user_preferences.taste_embedding IS 'Computed embedding representing user taste';
COMMENT ON COLUMN user_preferences.novelty_weight IS 'Weight for recommending outside usual genres (0-1)';


