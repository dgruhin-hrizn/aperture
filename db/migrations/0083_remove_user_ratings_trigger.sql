-- Remove the automatic updated_at trigger from user_ratings
-- We handle updated_at explicitly in application code to preserve timestamps
-- during Trakt sync when ratings haven't actually changed

DROP TRIGGER IF EXISTS trigger_user_ratings_updated_at ON user_ratings;

-- Reset any corrupted updated_at values to match created_at
-- This fixes ratings that were incorrectly updated by Trakt sync
UPDATE user_ratings SET updated_at = created_at WHERE updated_at > created_at;

