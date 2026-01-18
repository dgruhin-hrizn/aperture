-- Migration: Add 4096 dimension embedding tables and embedding_dimensions column
-- Supports larger embedding models like some Cohere and custom models
-- Note: Uses binary quantization for HNSW index (pgvector 4000 dim limit workaround)

-- ============================================================================
-- STEP 1: Add embedding_dimensions column to custom_ai_models table
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0091] Adding embedding_dimensions column to custom_ai_models...'; END $$;

ALTER TABLE custom_ai_models ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;

COMMENT ON COLUMN custom_ai_models.embedding_dimensions IS 'Vector dimension size for custom embedding models (only used when function_type = embeddings)';

-- ============================================================================
-- STEP 2: Create 4096 dimension tables for movies
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0091] Creating 4096 dimension embedding tables...'; END $$;

CREATE TABLE IF NOT EXISTS embeddings_4096 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(4096) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- ============================================================================
-- STEP 3: Create 4096 dimension tables for series
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_embeddings_4096 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(4096) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

-- ============================================================================
-- STEP 4: Create 4096 dimension tables for episodes
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_embeddings_4096 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(4096) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

-- ============================================================================
-- STEP 5: Create indexes for all 4096 tables using binary quantization
-- Note: pgvector HNSW/IVFFlat have a 4000 dimension limit
-- Binary quantization allows indexing larger vectors by converting to bits
-- Queries should use binary_quantize() for initial search, then re-rank
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0091] Creating binary quantized HNSW indexes on 4096 dimension tables...'; END $$;

-- Movie embeddings indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_4096_bq_hnsw ON embeddings_4096 
  USING hnsw ((binary_quantize(embedding)::bit(4096)) bit_hamming_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_4096_movie_id ON embeddings_4096(movie_id);

-- Series embeddings indexes
CREATE INDEX IF NOT EXISTS idx_series_embeddings_4096_bq_hnsw ON series_embeddings_4096 
  USING hnsw ((binary_quantize(embedding)::bit(4096)) bit_hamming_ops);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_4096_series_id ON series_embeddings_4096(series_id);

-- Episode embeddings indexes
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_4096_bq_hnsw ON episode_embeddings_4096 
  USING hnsw ((binary_quantize(embedding)::bit(4096)) bit_hamming_ops);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_4096_episode_id ON episode_embeddings_4096(episode_id);

-- ============================================================================
-- STEP 6: Add table comments
-- ============================================================================

COMMENT ON TABLE embeddings_4096 IS 'Vector embeddings (4096 dim) for movies - uses binary quantized HNSW index';
COMMENT ON TABLE series_embeddings_4096 IS 'Vector embeddings (4096 dim) for TV series - uses binary quantized HNSW index';
COMMENT ON TABLE episode_embeddings_4096 IS 'Vector embeddings (4096 dim) for TV episodes - uses binary quantized HNSW index';

DO $$ BEGIN RAISE NOTICE '[0091] 4096 dimension embedding tables created successfully!'; END $$;
