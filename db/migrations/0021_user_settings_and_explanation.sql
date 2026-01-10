-- Migration: 0021_user_settings_and_explanation
-- Description: Add user settings table and AI explanation field for recommendations

-- User settings table for per-user configuration
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Library settings
  library_name TEXT, -- Custom name for AI recommendations library (null = use default)
  
  -- Future settings can be added here
  settings_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Add explanation column to recommendation_candidates
ALTER TABLE recommendation_candidates
ADD COLUMN ai_explanation TEXT;

-- Index for user settings
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_settings IS 'Per-user settings and preferences';
COMMENT ON COLUMN user_settings.library_name IS 'Custom name for the AI recommendations library in media server';
COMMENT ON COLUMN recommendation_candidates.ai_explanation IS 'AI-generated explanation of why this movie was recommended';



