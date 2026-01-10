-- Migration: 0053_user_ratings
-- Description: Create user_ratings table for explicit user ratings (10-heart system)

-- Create user_ratings table
CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Media references (exactly one must be set)
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,

  -- Rating on 1-10 scale (Trakt-compatible)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),

  -- Source of the rating
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'trakt')),

  -- Ensure exactly one media type is set
  CONSTRAINT user_ratings_one_media CHECK (
    (movie_id IS NOT NULL AND series_id IS NULL) OR
    (movie_id IS NULL AND series_id IS NOT NULL)
  )
);

-- Unique constraints (partial indexes for nullable columns)
CREATE UNIQUE INDEX idx_user_ratings_user_movie 
  ON user_ratings(user_id, movie_id) 
  WHERE movie_id IS NOT NULL;

CREATE UNIQUE INDEX idx_user_ratings_user_series 
  ON user_ratings(user_id, series_id) 
  WHERE series_id IS NOT NULL;

-- Query indexes
CREATE INDEX idx_user_ratings_user_id ON user_ratings(user_id);
CREATE INDEX idx_user_ratings_movie_id ON user_ratings(movie_id) WHERE movie_id IS NOT NULL;
CREATE INDEX idx_user_ratings_series_id ON user_ratings(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_user_ratings_rating ON user_ratings(user_id, rating);

-- Apply updated_at trigger
CREATE TRIGGER trigger_user_ratings_updated_at
  BEFORE UPDATE ON user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add dislike behavior preference to user_preferences
ALTER TABLE user_preferences ADD COLUMN dislike_behavior TEXT NOT NULL DEFAULT 'exclude'
  CHECK (dislike_behavior IN ('exclude', 'penalize'));

COMMENT ON TABLE user_ratings IS 'User content ratings on a 1-10 scale (Trakt-compatible)';
COMMENT ON COLUMN user_ratings.rating IS 'User rating from 1 (hate) to 10 (love)';
COMMENT ON COLUMN user_ratings.source IS 'Where the rating came from: manual entry or synced from Trakt';
COMMENT ON COLUMN user_preferences.dislike_behavior IS 'How to handle low-rated content: exclude from recommendations or penalize score';


