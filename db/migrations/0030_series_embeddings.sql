-- Migration: 0030_series_embeddings
-- Description: Create series_embeddings table for storing series vector embeddings

CREATE TABLE series_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reference to series
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,

  -- Embedding details
  model TEXT NOT NULL,
  embedding halfvec(3072) NOT NULL,

  -- The text that was embedded (for debugging/auditing)
  canonical_text TEXT,

  -- Unique constraint per series/model combination
  CONSTRAINT series_embeddings_series_model_unique UNIQUE (series_id, model)
);

-- Index for vector similarity search using HNSW
CREATE INDEX idx_series_embeddings_embedding ON series_embeddings 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Index for looking up embeddings by series
CREATE INDEX idx_series_embeddings_series_id ON series_embeddings(series_id);

COMMENT ON TABLE series_embeddings IS 'Vector embeddings for TV series from OpenAI';
COMMENT ON COLUMN series_embeddings.model IS 'OpenAI embedding model used';
COMMENT ON COLUMN series_embeddings.canonical_text IS 'The text that was embedded for this series';


