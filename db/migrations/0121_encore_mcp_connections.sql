CREATE TABLE encore_mcp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX encore_mcp_connections_owner ON encore_mcp_connections(user_id);
