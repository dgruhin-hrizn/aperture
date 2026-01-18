-- Migration: 0093_watch_history_series_index
-- Description: Add composite index to improve series watch history query performance
-- Part of v0.5.7 performance improvements

-- This index optimizes queries that filter by user_id and join through episode_id
-- particularly for series taste profile stats and watch history aggregations
CREATE INDEX idx_watch_history_user_episode_composite 
ON watch_history(user_id, episode_id) 
WHERE episode_id IS NOT NULL;

COMMENT ON INDEX idx_watch_history_user_episode_composite IS 'Composite index for efficient series watch history queries (user + episode)';
