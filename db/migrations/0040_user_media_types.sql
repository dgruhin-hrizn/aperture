-- Add separate toggles for movies and series recommendations per user
-- This replaces the single is_enabled column with two separate columns

-- Add new columns
ALTER TABLE users ADD COLUMN movies_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN series_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate existing is_enabled values to movies_enabled
-- (users who had AI enabled get movies enabled by default)
UPDATE users SET movies_enabled = is_enabled;

-- Create indexes for efficient filtering
CREATE INDEX idx_users_movies_enabled ON users(movies_enabled) WHERE movies_enabled = TRUE;
CREATE INDEX idx_users_series_enabled ON users(series_enabled) WHERE series_enabled = TRUE;

-- Add comments
COMMENT ON COLUMN users.movies_enabled IS 'Whether user has AI movie recommendations enabled';
COMMENT ON COLUMN users.series_enabled IS 'Whether user has AI series recommendations enabled';



