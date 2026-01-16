-- Add minimum franchise filtering settings to user taste profiles
-- Users can filter franchises by both total size and watched count

-- Minimum items watched from the franchise
ALTER TABLE user_taste_profiles
ADD COLUMN IF NOT EXISTS min_franchise_items INTEGER NOT NULL DEFAULT 2;

-- Minimum total items the franchise must have in the library
ALTER TABLE user_taste_profiles
ADD COLUMN IF NOT EXISTS min_franchise_size INTEGER NOT NULL DEFAULT 2;

COMMENT ON COLUMN user_taste_profiles.min_franchise_items IS 'Minimum number of items watched to include a franchise (1-10)';
COMMENT ON COLUMN user_taste_profiles.min_franchise_size IS 'Minimum total items a franchise must have in library (2-10)';

