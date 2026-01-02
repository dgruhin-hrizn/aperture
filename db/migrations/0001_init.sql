-- Migration: 0001_init
-- Description: Create aperture_migrations tracking table
-- Note: This table is also created by the migration runner itself,
-- but having it as a migration ensures consistency

CREATE TABLE IF NOT EXISTS aperture_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE aperture_migrations IS 'Tracks applied database migrations';

