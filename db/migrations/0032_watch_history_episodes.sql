-- Migration: 0032_watch_history_episodes
-- Description: Extend watch_history to support episode tracking

-- Make movie_id nullable
ALTER TABLE watch_history ALTER COLUMN movie_id DROP NOT NULL;

-- Add episode reference
ALTER TABLE watch_history ADD COLUMN episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE;

-- Add media type discriminator
ALTER TABLE watch_history ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'
  CHECK (media_type IN ('movie', 'episode'));

-- Drop the old unique constraint
ALTER TABLE watch_history DROP CONSTRAINT IF EXISTS watch_history_user_movie_unique;

-- Add new unique constraint that handles both movie and episode
-- Using COALESCE to handle NULLs in unique constraint
CREATE UNIQUE INDEX watch_history_user_media_unique 
  ON watch_history (user_id, COALESCE(movie_id, '00000000-0000-0000-0000-000000000000'), COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'));

-- Add check constraint: exactly one of movie_id or episode_id must be set
ALTER TABLE watch_history ADD CONSTRAINT watch_history_media_check
  CHECK (
    (movie_id IS NOT NULL AND episode_id IS NULL AND media_type = 'movie') OR
    (movie_id IS NULL AND episode_id IS NOT NULL AND media_type = 'episode')
  );

-- Add indexes
CREATE INDEX idx_watch_history_episode_id ON watch_history(episode_id);
CREATE INDEX idx_watch_history_media_type ON watch_history(user_id, media_type);

COMMENT ON COLUMN watch_history.episode_id IS 'Reference to episode (for TV watch history)';
COMMENT ON COLUMN watch_history.media_type IS 'Type of media: movie or episode';


