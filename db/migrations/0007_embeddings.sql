-- Migration: 0007_embeddings
-- Description: Create embeddings table for storing movie vector embeddings

CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reference to movie
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,

  -- Embedding details
  model TEXT NOT NULL, -- e.g., 'text-embedding-3-small'
  embedding vector(1536) NOT NULL,

  -- The text that was embedded (for debugging/auditing)
  canonical_text TEXT,

  -- Unique constraint per movie/model combination
  CONSTRAINT embeddings_movie_model_unique UNIQUE (movie_id, model)
);

-- Index for vector similarity search
CREATE INDEX idx_embeddings_embedding ON embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for looking up embeddings by movie
CREATE INDEX idx_embeddings_movie_id ON embeddings(movie_id);

COMMENT ON TABLE embeddings IS 'Vector embeddings for movies from OpenAI';
COMMENT ON COLUMN embeddings.model IS 'OpenAI embedding model used';
COMMENT ON COLUMN embeddings.canonical_text IS 'The text that was embedded for this movie';


