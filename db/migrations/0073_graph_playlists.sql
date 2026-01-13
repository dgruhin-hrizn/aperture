-- Graph Playlists: Playlists created directly from similarity graphs
-- These are separate from channel-based playlists

CREATE TABLE IF NOT EXISTS graph_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    media_server_playlist_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_item_id TEXT,           -- Original center node ID
    source_item_type TEXT,         -- 'movie' or 'series'
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by owner
CREATE INDEX IF NOT EXISTS idx_graph_playlists_owner ON graph_playlists(owner_id);

-- Index for finding by media server playlist ID
CREATE INDEX IF NOT EXISTS idx_graph_playlists_media_server ON graph_playlists(media_server_playlist_id);

COMMENT ON TABLE graph_playlists IS 'Playlists created from similarity graph exploration';
COMMENT ON COLUMN graph_playlists.source_item_id IS 'The movie/series ID that was the center of the graph when playlist was created';
COMMENT ON COLUMN graph_playlists.source_item_type IS 'Type of the source item: movie or series';
COMMENT ON COLUMN graph_playlists.media_server_playlist_id IS 'The playlist ID on Emby/Jellyfin';

