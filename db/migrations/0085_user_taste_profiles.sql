-- User Taste Profile System
-- Persistent, user-editable taste profiles for recommendations, similarity, explore, and discovery

-- Main taste profile with embedding vectors
CREATE TABLE user_taste_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),
    embedding halfvec(3072),
    embedding_model TEXT,
    auto_updated_at TIMESTAMPTZ,
    user_modified_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT false,  -- User can lock to prevent auto-updates
    refresh_interval_days INTEGER DEFAULT 30,  -- 7-365, user-configurable
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, media_type)
);

-- Franchise/collection preferences (auto-detected + user-editable)
CREATE TABLE user_franchise_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    franchise_name TEXT NOT NULL,  -- e.g., "Star Trek", "Marvel Cinematic Universe"
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series', 'both')),
    preference_score NUMERIC DEFAULT 0,  -- -1 to 1 (dislike to love)
    is_user_set BOOLEAN DEFAULT false,   -- true if user manually set
    items_watched INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,  -- episodes/movies watched
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, franchise_name, media_type)
);

-- Genre weight preferences
CREATE TABLE user_genre_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    weight NUMERIC DEFAULT 1.0,  -- 0 = avoid, 1 = neutral, 2 = boost
    is_user_set BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, genre)
);

-- Custom user interests (free text that gets embedded)
CREATE TABLE user_custom_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_text TEXT NOT NULL,  -- e.g., "I love time travel stories"
    embedding halfvec(3072),
    embedding_model TEXT,
    weight NUMERIC DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_user_taste_profiles_user_id ON user_taste_profiles(user_id);
CREATE INDEX idx_user_taste_profiles_stale ON user_taste_profiles(user_id, media_type, auto_updated_at);
CREATE INDEX idx_user_franchise_preferences_user_id ON user_franchise_preferences(user_id);
CREATE INDEX idx_user_franchise_preferences_franchise ON user_franchise_preferences(franchise_name);
CREATE INDEX idx_user_genre_weights_user_id ON user_genre_weights(user_id);
CREATE INDEX idx_user_custom_interests_user_id ON user_custom_interests(user_id);

-- Add updated_at trigger for franchise preferences
CREATE TRIGGER trigger_user_franchise_preferences_updated_at
    BEFORE UPDATE ON user_franchise_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for genre weights
CREATE TRIGGER trigger_user_genre_weights_updated_at
    BEFORE UPDATE ON user_genre_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

