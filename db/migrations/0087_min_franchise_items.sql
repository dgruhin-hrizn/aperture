-- Add minimum franchise items setting to user taste profiles
-- This allows users to filter out franchises where they've watched fewer than X items

ALTER TABLE user_taste_profiles
ADD COLUMN IF NOT EXISTS min_franchise_items INTEGER NOT NULL DEFAULT 2;

-- Add comment
COMMENT ON COLUMN user_taste_profiles.min_franchise_items IS 'Minimum number of items watched to include a franchise (2-10)';

