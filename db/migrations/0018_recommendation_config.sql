-- Migration: 0018_recommendation_config
-- Description: Create recommendation_config table for global recommendation settings

-- Single-row config table (only one row ever exists)
CREATE TABLE recommendation_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures only one row
  
  -- Candidate selection
  max_candidates INTEGER NOT NULL DEFAULT 50000,      -- How many movies to consider (high = more thorough, slower)
  selected_count INTEGER NOT NULL DEFAULT 12,         -- Final recommendations per user
  recent_watch_limit INTEGER NOT NULL DEFAULT 50,     -- Movies used to build taste profile
  
  -- Scoring weights (must sum to ~1.0 for balanced scoring)
  similarity_weight NUMERIC(3,2) NOT NULL DEFAULT 0.40,  -- Weight for taste similarity
  novelty_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,     -- Weight for genre discovery
  rating_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,      -- Weight for community ratings
  diversity_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,   -- Weight for variety in results
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default row
INSERT INTO recommendation_config (id) VALUES (1);

-- Apply updated_at trigger
CREATE TRIGGER trigger_recommendation_config_updated_at
  BEFORE UPDATE ON recommendation_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE recommendation_config IS 'Global recommendation algorithm configuration (single row)';
COMMENT ON COLUMN recommendation_config.max_candidates IS 'Maximum movies to consider as candidates (higher = more thorough but slower)';
COMMENT ON COLUMN recommendation_config.selected_count IS 'Number of final recommendations per user';
COMMENT ON COLUMN recommendation_config.recent_watch_limit IS 'Number of recent watches used to build taste profile';
COMMENT ON COLUMN recommendation_config.similarity_weight IS 'How much to weight taste similarity (0-1)';
COMMENT ON COLUMN recommendation_config.novelty_weight IS 'How much to weight discovering new genres (0-1)';
COMMENT ON COLUMN recommendation_config.rating_weight IS 'How much to weight community ratings (0-1)';
COMMENT ON COLUMN recommendation_config.diversity_weight IS 'How much to weight variety in results (0-1)';



