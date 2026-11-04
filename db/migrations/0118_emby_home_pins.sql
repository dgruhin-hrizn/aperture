CREATE TABLE emby_home_pins (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, server_id, provider_user_id, playlist_id),
  UNIQUE (server_id, provider_user_id, section_id)
);
