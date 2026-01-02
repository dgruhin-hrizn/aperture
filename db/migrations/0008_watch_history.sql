-- Migration: 0008_watch_history
-- Description: Create watch_history table for tracking user viewing activity

CREATE TABLE watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,

  -- Watch data from media server
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,

  -- User preferences
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  user_rating NUMERIC(3, 1), -- User's personal rating if available

  -- Unique constraint per user/movie
  CONSTRAINT watch_history_user_movie_unique UNIQUE (user_id, movie_id)
);

-- Indexes
CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX idx_watch_history_movie_id ON watch_history(movie_id);
CREATE INDEX idx_watch_history_last_played ON watch_history(user_id, last_played_at DESC);
CREATE INDEX idx_watch_history_favorites ON watch_history(user_id) WHERE is_favorite = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER trigger_watch_history_updated_at
  BEFORE UPDATE ON watch_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE watch_history IS 'User watch history synced from media server';
COMMENT ON COLUMN watch_history.play_count IS 'Number of times the user has played this movie';

