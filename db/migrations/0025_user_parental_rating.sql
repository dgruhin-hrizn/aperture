-- Migration: 0025_user_parental_rating
-- Description: Add max parental rating to users for content filtering

-- Add max_parental_rating column to users table
-- This stores the numeric value from Emby's MaxParentalRating user policy
-- NULL means no restriction (admin/unrestricted users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_parental_rating INTEGER;

-- Add comment
COMMENT ON COLUMN users.max_parental_rating IS 'Maximum allowed parental rating from media server (NULL = unrestricted)';

-- Create a lookup table for common rating values
-- This helps map content_rating strings to numeric values
CREATE TABLE IF NOT EXISTS parental_rating_values (
  id SERIAL PRIMARY KEY,
  rating_name TEXT NOT NULL UNIQUE,
  rating_value INTEGER NOT NULL,
  country TEXT DEFAULT 'US'
);

-- Insert common MPAA ratings (US)
INSERT INTO parental_rating_values (rating_name, rating_value, country) VALUES
  ('G', 1, 'US'),
  ('TV-Y', 1, 'US'),
  ('TV-Y7', 2, 'US'),
  ('TV-G', 3, 'US'),
  ('PG', 4, 'US'),
  ('TV-PG', 5, 'US'),
  ('PG-13', 7, 'US'),
  ('TV-14', 8, 'US'),
  ('R', 9, 'US'),
  ('TV-MA', 10, 'US'),
  ('NC-17', 11, 'US'),
  ('NR', 100, 'US'),
  ('Unrated', 100, 'US')
ON CONFLICT (rating_name) DO NOTHING;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_parental_rating_values_name ON parental_rating_values(rating_name);


