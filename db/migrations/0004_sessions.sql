-- Migration: 0004_sessions
-- Description: Create sessions table for user authentication

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Index for looking up sessions by user
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Index for cleaning up expired sessions
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

COMMENT ON TABLE sessions IS 'User authentication sessions';
COMMENT ON COLUMN sessions.data IS 'Additional session metadata as JSON';

