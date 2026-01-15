-- Variable-dimension taste embeddings
-- Changes taste_embedding and series_taste_embedding columns to use halfvec without 
-- dimension constraints, allowing them to store embeddings of any dimension.
-- This is necessary because taste embeddings must match the current embedding model's dimensions,
-- which varies by provider (e.g., OpenAI 3072, Ollama/nomic 768).

DO $$ BEGIN RAISE NOTICE '[0079] Updating taste embedding columns to variable dimensions...'; END $$;

-- Remove dimension constraint from movie taste embedding column
-- The USING clause preserves existing data by casting to halfvec without dimensions
ALTER TABLE user_preferences 
  ALTER COLUMN taste_embedding TYPE halfvec 
    USING taste_embedding::halfvec;

DO $$ BEGIN RAISE NOTICE '[0079] Updated taste_embedding column to variable-dimension halfvec'; END $$;

-- Remove dimension constraint from series taste embedding column
ALTER TABLE user_preferences 
  ALTER COLUMN series_taste_embedding TYPE halfvec 
    USING series_taste_embedding::halfvec;

DO $$ BEGIN RAISE NOTICE '[0079] Updated series_taste_embedding column to variable-dimension halfvec'; END $$;

-- Clear existing taste embeddings since they may have wrong dimensions for current model
-- They will be automatically regenerated on next recommendation run
UPDATE user_preferences SET 
  taste_embedding = NULL, 
  taste_embedding_updated_at = NULL,
  series_taste_embedding = NULL,
  series_taste_embedding_updated_at = NULL
WHERE taste_embedding IS NOT NULL 
   OR series_taste_embedding IS NOT NULL;

DO $$ BEGIN RAISE NOTICE '[0079] Cleared existing taste embeddings (will regenerate with correct dimensions)'; END $$;

-- Update column comments
COMMENT ON COLUMN user_preferences.taste_embedding IS 'Computed embedding representing user movie taste (variable dimensions based on model)';
COMMENT ON COLUMN user_preferences.series_taste_embedding IS 'Computed embedding representing user TV series taste (variable dimensions based on model)';

DO $$ BEGIN RAISE NOTICE '[0079] Variable-dimension taste embedding migration complete!'; END $$;

