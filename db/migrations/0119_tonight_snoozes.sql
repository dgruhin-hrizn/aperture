CREATE TABLE tonight_snoozes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, title_key)
);
