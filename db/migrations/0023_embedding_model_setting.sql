-- Migration: 0023_embedding_model_setting
-- Description: Add system settings table for configurable options like embedding model

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply updated_at trigger
CREATE TRIGGER trigger_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default embedding model setting
INSERT INTO system_settings (key, value, description)
VALUES (
  'embedding_model',
  'text-embedding-3-small',
  'OpenAI embedding model to use. Options: text-embedding-3-small (faster, cheaper), text-embedding-3-large (better quality)'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_settings IS 'System-wide configuration settings';

