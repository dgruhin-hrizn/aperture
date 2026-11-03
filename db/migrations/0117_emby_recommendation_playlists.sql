CREATE TABLE emby_recommendation_playlists (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('movies', 'series')),
  group_key TEXT NOT NULL DEFAULT '',
  provider_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, media_type, group_key)
);
