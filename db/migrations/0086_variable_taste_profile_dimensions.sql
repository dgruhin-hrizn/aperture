-- Variable-dimension taste profile embeddings
-- Changes embedding columns to use halfvec without dimension constraints,
-- allowing them to store embeddings of any dimension.
-- This is necessary because taste embeddings must match the current embedding model's dimensions,
-- which varies by provider (e.g., OpenAI 3072, Ollama/nomic 768, mxbai 1024).

DO $$ BEGIN RAISE NOTICE '[0086] Updating taste profile embedding columns to variable dimensions...'; END $$;

-- Remove dimension constraint from user_taste_profiles.embedding column
-- The USING clause preserves existing data by casting to halfvec without dimensions
ALTER TABLE user_taste_profiles 
  ALTER COLUMN embedding TYPE halfvec 
    USING embedding::halfvec;

DO $$ BEGIN RAISE NOTICE '[0086] Updated user_taste_profiles.embedding to variable-dimension halfvec'; END $$;

-- Remove dimension constraint from user_custom_interests.embedding column
ALTER TABLE user_custom_interests 
  ALTER COLUMN embedding TYPE halfvec 
    USING embedding::halfvec;

DO $$ BEGIN RAISE NOTICE '[0086] Updated user_custom_interests.embedding to variable-dimension halfvec'; END $$;

-- Clear existing taste profile embeddings since they may have wrong dimensions for current model
-- They will be automatically regenerated on next access
UPDATE user_taste_profiles SET 
  embedding = NULL, 
  embedding_model = NULL,
  auto_updated_at = NULL
WHERE embedding IS NOT NULL;

DO $$ BEGIN RAISE NOTICE '[0086] Cleared existing taste profile embeddings (will regenerate with correct dimensions)'; END $$;

-- Clear existing custom interest embeddings
UPDATE user_custom_interests SET 
  embedding = NULL,
  embedding_model = NULL
WHERE embedding IS NOT NULL;

DO $$ BEGIN RAISE NOTICE '[0086] Cleared existing custom interest embeddings (will regenerate with correct dimensions)'; END $$;

-- Update column comments
COMMENT ON COLUMN user_taste_profiles.embedding IS 'Computed embedding representing user taste (variable dimensions based on model)';
COMMENT ON COLUMN user_custom_interests.embedding IS 'User custom interest embedding (variable dimensions based on model)';

DO $$ BEGIN RAISE NOTICE '[0086] Variable-dimension taste profile embedding migration complete!'; END $$;

