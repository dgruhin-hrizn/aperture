-- Migration: 0014_fix_rating_columns
-- Description: Fix numeric overflow for rating columns (critic ratings can be 0-100)

-- Change community_rating to allow higher precision (0-10 scale, but be safe)
ALTER TABLE movies 
  ALTER COLUMN community_rating TYPE NUMERIC(5, 2);

-- Change critic_rating to allow 0-100 scale (Rotten Tomatoes, etc.)
ALTER TABLE movies 
  ALTER COLUMN critic_rating TYPE NUMERIC(5, 2);

COMMENT ON COLUMN movies.community_rating IS 'Community rating (typically 0-10 scale)';
COMMENT ON COLUMN movies.critic_rating IS 'Critic rating (typically 0-100 scale like Rotten Tomatoes)';



