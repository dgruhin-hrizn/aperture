-- Store pre-generated assistant suggestions per user
CREATE TABLE IF NOT EXISTS assistant_suggestions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  suggestions JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_assistant_suggestions_updated_at ON assistant_suggestions(updated_at);

-- Add trigger for updated_at
CREATE TRIGGER set_assistant_suggestions_updated_at
  BEFORE UPDATE ON assistant_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

