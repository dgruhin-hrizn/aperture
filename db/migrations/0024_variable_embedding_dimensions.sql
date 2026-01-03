-- Migration: 0024_large_embedding_model
-- Description: Use text-embedding-3-large (3072 dimensions) for best quality recommendations
-- Using halfvec (16-bit float) instead of vector (32-bit) to support >2000 dimensions
-- halfvec supports up to 4,000 dimensions, vector only supports up to 2,000

-- Clear existing embeddings (wrong dimensions)
DELETE FROM embeddings;

-- Drop existing index
DROP INDEX IF EXISTS idx_embeddings_embedding;

-- Update embedding column to 3072 dimensions using halfvec
ALTER TABLE embeddings DROP COLUMN embedding;
ALTER TABLE embeddings ADD COLUMN embedding halfvec(3072) NOT NULL;

-- Create HNSW index using halfvec cosine ops
CREATE INDEX idx_embeddings_embedding ON embeddings 
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Update taste embeddings too (using halfvec)
UPDATE user_preferences SET taste_embedding = NULL, taste_embedding_updated_at = NULL;
ALTER TABLE user_preferences DROP COLUMN taste_embedding;
ALTER TABLE user_preferences ADD COLUMN taste_embedding halfvec(3072);

-- Set the default model to large
INSERT INTO system_settings (key, value, description)
VALUES ('embedding_model', 'text-embedding-3-large', 'OpenAI embedding model - using large for best quality')
ON CONFLICT (key) DO UPDATE SET value = 'text-embedding-3-large', updated_at = NOW();

