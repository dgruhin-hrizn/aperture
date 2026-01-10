-- Migration: 0063_user_watching_series
-- Description: Create table for tracking series users are currently watching

CREATE TABLE user_watching_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, series_id)
);

CREATE INDEX idx_user_watching_series_user ON user_watching_series(user_id);
CREATE INDEX idx_user_watching_series_series ON user_watching_series(series_id);

COMMENT ON TABLE user_watching_series IS 'Tracks which series each user is currently watching';
COMMENT ON COLUMN user_watching_series.added_at IS 'When the user added this series to their watching list';



