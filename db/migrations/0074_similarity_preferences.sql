-- Similarity Graph User Preferences
-- Two new settings for controlling similarity graph behavior

-- Full Franchise Mode: When ON, show all movies from a franchise without limits
-- Default OFF: Use dynamic collection limits
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS similarity_full_franchise BOOLEAN DEFAULT FALSE;

-- Hide Watched Content: When ON, filter out already-watched content from graphs
-- Default ON: Hide watched content to surface new discoveries
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS similarity_hide_watched BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN user_preferences.similarity_full_franchise IS 'When true, show entire franchise in similarity graphs without collection limits';
COMMENT ON COLUMN user_preferences.similarity_hide_watched IS 'When true, hide already-watched content from similarity graphs';

