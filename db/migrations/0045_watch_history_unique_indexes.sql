-- Add partial unique indexes for watch_history to support ON CONFLICT
-- These allow proper upsert behavior for movies and episodes separately

-- Unique index for movie watch history (user_id + movie_id where movie_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_user_movie_unique 
ON watch_history (user_id, movie_id) 
WHERE movie_id IS NOT NULL;

-- Unique index for episode watch history (user_id + episode_id where episode_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_user_episode_unique 
ON watch_history (user_id, episode_id) 
WHERE episode_id IS NOT NULL;

COMMENT ON INDEX idx_watch_history_user_movie_unique IS 'Ensures each user can only have one watch history entry per movie';
COMMENT ON INDEX idx_watch_history_user_episode_unique IS 'Ensures each user can only have one watch history entry per episode';

