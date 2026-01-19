-- Migration: 0097_api_keys
-- Description: Create api_keys table for API key authentication

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the key
  key_prefix VARCHAR(8) NOT NULL,        -- First 8 chars for identification (e.g., apt_xxxx)
  expires_at TIMESTAMPTZ,                -- NULL = never expires
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ                 -- Soft delete for audit trail
);

-- Index for looking up API keys by user
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Index for fast key lookup during authentication
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Index for finding non-revoked keys
CREATE INDEX idx_api_keys_active ON api_keys(key_hash) WHERE revoked_at IS NULL;

COMMENT ON TABLE api_keys IS 'API keys for programmatic access to the API';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key - plaintext is never stored';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of the key for identification in UI';
COMMENT ON COLUMN api_keys.expires_at IS 'NULL means the key never expires';
COMMENT ON COLUMN api_keys.revoked_at IS 'Soft delete timestamp - revoked keys are kept for audit';
