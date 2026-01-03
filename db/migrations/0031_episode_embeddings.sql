-- Migration: 0031_episode_embeddings
-- Description: Create episode_embeddings table for storing episode vector embeddings

CREATE TABLE episode_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reference to episode
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,

  -- Embedding details
  model TEXT NOT NULL,
  embedding halfvec(3072) NOT NULL,

  -- The text that was embedded (for debugging/auditing)
  canonical_text TEXT,

  -- Unique constraint per episode/model combination
  CONSTRAINT episode_embeddings_episode_model_unique UNIQUE (episode_id, model)
);

-- Index for vector similarity search using HNSW
CREATE INDEX idx_episode_embeddings_embedding ON episode_embeddings 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Index for looking up embeddings by episode
CREATE INDEX idx_episode_embeddings_episode_id ON episode_embeddings(episode_id);

COMMENT ON TABLE episode_embeddings IS 'Vector embeddings for TV episodes from OpenAI';
COMMENT ON COLUMN episode_embeddings.model IS 'OpenAI embedding model used';
COMMENT ON COLUMN episode_embeddings.canonical_text IS 'The text that was embedded for this episode';

