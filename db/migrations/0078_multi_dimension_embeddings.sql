-- Multi-dimension embedding tables
-- Creates dimension-specific tables for embeddings to support different embedding models
-- with varying vector dimensions (256, 384, 512, 768, 1024, 1536, 3072)

-- ============================================================================
-- STEP 1: Create dimension-specific tables for movies
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0078] Creating dimension-specific embedding tables...'; END $$;

-- 256 dimensions (Google text-embedding reduced, etc.)
CREATE TABLE IF NOT EXISTS embeddings_256 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(256) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 384 dimensions (all-minilm, Cohere embed-light, bge-small)
CREATE TABLE IF NOT EXISTS embeddings_384 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(384) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 512 dimensions (Voyage AI lite)
CREATE TABLE IF NOT EXISTS embeddings_512 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(512) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 768 dimensions (nomic-embed-text, Google text-embedding-004/005, bge-base)
CREATE TABLE IF NOT EXISTS embeddings_768 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(768) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 1024 dimensions (mxbai-embed-large, Cohere embed-v3, Voyage, Jina, Mistral)
CREATE TABLE IF NOT EXISTS embeddings_1024 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1024) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 1536 dimensions (OpenAI text-embedding-3-small, Amazon Titan)
CREATE TABLE IF NOT EXISTS embeddings_1536 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1536) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

-- 3072 dimensions (OpenAI text-embedding-3-large)
CREATE TABLE IF NOT EXISTS embeddings_3072 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(3072) NOT NULL,
  canonical_text TEXT,
  UNIQUE(movie_id, model)
);

DO $$ BEGIN RAISE NOTICE '[0078] Creating dimension-specific series embedding tables...'; END $$;

-- ============================================================================
-- STEP 2: Create dimension-specific tables for series
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_embeddings_256 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(256) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_384 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(384) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_512 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(512) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_768 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(768) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_1024 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1024) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_1536 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1536) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

CREATE TABLE IF NOT EXISTS series_embeddings_3072 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(3072) NOT NULL,
  canonical_text TEXT,
  UNIQUE(series_id, model)
);

DO $$ BEGIN RAISE NOTICE '[0078] Creating dimension-specific episode embedding tables...'; END $$;

-- ============================================================================
-- STEP 3: Create dimension-specific tables for episodes
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_embeddings_256 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(256) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_384 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(384) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_512 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(512) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_768 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(768) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_1024 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1024) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_1536 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(1536) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

CREATE TABLE IF NOT EXISTS episode_embeddings_3072 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding halfvec(3072) NOT NULL,
  canonical_text TEXT,
  UNIQUE(episode_id, model)
);

-- ============================================================================
-- STEP 4: Create HNSW indexes for all new tables (CONCURRENTLY for production)
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0078] Creating HNSW indexes on embedding tables...'; END $$;

-- Movie embeddings indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_256_hnsw ON embeddings_256 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_384_hnsw ON embeddings_384 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_512_hnsw ON embeddings_512 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_768_hnsw ON embeddings_768 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_1024_hnsw ON embeddings_1024 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_1536_hnsw ON embeddings_1536 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_embeddings_3072_hnsw ON embeddings_3072 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Movie ID indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_256_movie_id ON embeddings_256(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_384_movie_id ON embeddings_384(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_512_movie_id ON embeddings_512(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_768_movie_id ON embeddings_768(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_1024_movie_id ON embeddings_1024(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_1536_movie_id ON embeddings_1536(movie_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_3072_movie_id ON embeddings_3072(movie_id);

-- Series embeddings indexes
CREATE INDEX IF NOT EXISTS idx_series_embeddings_256_hnsw ON series_embeddings_256 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_384_hnsw ON series_embeddings_384 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_512_hnsw ON series_embeddings_512 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_768_hnsw ON series_embeddings_768 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_1024_hnsw ON series_embeddings_1024 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_1536_hnsw ON series_embeddings_1536 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_3072_hnsw ON series_embeddings_3072 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Series ID indexes
CREATE INDEX IF NOT EXISTS idx_series_embeddings_256_series_id ON series_embeddings_256(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_384_series_id ON series_embeddings_384(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_512_series_id ON series_embeddings_512(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_768_series_id ON series_embeddings_768(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_1024_series_id ON series_embeddings_1024(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_1536_series_id ON series_embeddings_1536(series_id);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_3072_series_id ON series_embeddings_3072(series_id);

-- Episode embeddings indexes
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_256_hnsw ON episode_embeddings_256 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_384_hnsw ON episode_embeddings_384 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_512_hnsw ON episode_embeddings_512 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_768_hnsw ON episode_embeddings_768 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_1024_hnsw ON episode_embeddings_1024 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_1536_hnsw ON episode_embeddings_1536 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_3072_hnsw ON episode_embeddings_3072 
  USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Episode ID indexes
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_256_episode_id ON episode_embeddings_256(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_384_episode_id ON episode_embeddings_384(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_512_episode_id ON episode_embeddings_512(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_768_episode_id ON episode_embeddings_768(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_1024_episode_id ON episode_embeddings_1024(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_1536_episode_id ON episode_embeddings_1536(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_3072_episode_id ON episode_embeddings_3072(episode_id);

-- ============================================================================
-- STEP 5: Migrate existing data from old tables to new dimension-specific tables
-- The old tables use halfvec(3072), so we migrate to the 3072 dimension tables
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0078] Migrating existing movie embeddings to dimension-specific table...'; END $$;

-- Migrate movie embeddings (all existing are 3072 dimension)
DO $$
DECLARE
  total_rows INTEGER;
  batch_size INTEGER := 1000;
  migrated INTEGER := 0;
BEGIN
  -- Check if source table exists and has data
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embeddings' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO total_rows FROM embeddings;
    RAISE NOTICE '[0078] Found % movie embeddings to migrate', total_rows;
    
    IF total_rows > 0 THEN
      -- Migrate in batches
      WHILE migrated < total_rows LOOP
        INSERT INTO embeddings_3072 (id, created_at, movie_id, model, embedding, canonical_text)
        SELECT id, created_at, movie_id, model, embedding, canonical_text
        FROM embeddings
        ORDER BY id
        OFFSET migrated LIMIT batch_size
        ON CONFLICT (movie_id, model) DO NOTHING;
        
        migrated := migrated + batch_size;
        IF migrated % 5000 = 0 OR migrated >= total_rows THEN
          RAISE NOTICE '[0078] Migrated % / % movie embeddings', LEAST(migrated, total_rows), total_rows;
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '[0078] Migrating existing series embeddings to dimension-specific table...'; END $$;

-- Migrate series embeddings
DO $$
DECLARE
  total_rows INTEGER;
  batch_size INTEGER := 1000;
  migrated INTEGER := 0;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'series_embeddings' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO total_rows FROM series_embeddings;
    RAISE NOTICE '[0078] Found % series embeddings to migrate', total_rows;
    
    IF total_rows > 0 THEN
      WHILE migrated < total_rows LOOP
        INSERT INTO series_embeddings_3072 (id, created_at, series_id, model, embedding, canonical_text)
        SELECT id, created_at, series_id, model, embedding, canonical_text
        FROM series_embeddings
        ORDER BY id
        OFFSET migrated LIMIT batch_size
        ON CONFLICT (series_id, model) DO NOTHING;
        
        migrated := migrated + batch_size;
        IF migrated % 5000 = 0 OR migrated >= total_rows THEN
          RAISE NOTICE '[0078] Migrated % / % series embeddings', LEAST(migrated, total_rows), total_rows;
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '[0078] Migrating existing episode embeddings to dimension-specific table...'; END $$;

-- Migrate episode embeddings
DO $$
DECLARE
  total_rows INTEGER;
  batch_size INTEGER := 1000;
  migrated INTEGER := 0;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'episode_embeddings' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO total_rows FROM episode_embeddings;
    RAISE NOTICE '[0078] Found % episode embeddings to migrate', total_rows;
    
    IF total_rows > 0 THEN
      WHILE migrated < total_rows LOOP
        INSERT INTO episode_embeddings_3072 (id, created_at, episode_id, model, embedding, canonical_text)
        SELECT id, created_at, episode_id, model, embedding, canonical_text
        FROM episode_embeddings
        ORDER BY id
        OFFSET migrated LIMIT batch_size
        ON CONFLICT (episode_id, model) DO NOTHING;
        
        migrated := migrated + batch_size;
        IF migrated % 5000 = 0 OR migrated >= total_rows THEN
          RAISE NOTICE '[0078] Migrated % / % episode embeddings', LEAST(migrated, total_rows), total_rows;
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Rename old tables to legacy (preserving them as backup)
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '[0078] Renaming old embedding tables to *_legacy...'; END $$;

-- Only rename if they exist and haven't been renamed already
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embeddings' AND table_schema = 'public') 
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embeddings_legacy' AND table_schema = 'public') THEN
    ALTER TABLE embeddings RENAME TO embeddings_legacy;
    RAISE NOTICE '[0078] Renamed embeddings -> embeddings_legacy';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'series_embeddings' AND table_schema = 'public')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'series_embeddings_legacy' AND table_schema = 'public') THEN
    ALTER TABLE series_embeddings RENAME TO series_embeddings_legacy;
    RAISE NOTICE '[0078] Renamed series_embeddings -> series_embeddings_legacy';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'episode_embeddings' AND table_schema = 'public')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'episode_embeddings_legacy' AND table_schema = 'public') THEN
    ALTER TABLE episode_embeddings RENAME TO episode_embeddings_legacy;
    RAISE NOTICE '[0078] Renamed episode_embeddings -> episode_embeddings_legacy';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Add table comments
-- ============================================================================

COMMENT ON TABLE embeddings_256 IS 'Vector embeddings (256 dim) for movies - Google reduced, etc.';
COMMENT ON TABLE embeddings_384 IS 'Vector embeddings (384 dim) for movies - all-minilm, bge-small';
COMMENT ON TABLE embeddings_512 IS 'Vector embeddings (512 dim) for movies - Voyage AI lite';
COMMENT ON TABLE embeddings_768 IS 'Vector embeddings (768 dim) for movies - nomic-embed-text, Google';
COMMENT ON TABLE embeddings_1024 IS 'Vector embeddings (1024 dim) for movies - mxbai, Cohere, Jina';
COMMENT ON TABLE embeddings_1536 IS 'Vector embeddings (1536 dim) for movies - OpenAI small, Titan';
COMMENT ON TABLE embeddings_3072 IS 'Vector embeddings (3072 dim) for movies - OpenAI large';

COMMENT ON TABLE series_embeddings_256 IS 'Vector embeddings (256 dim) for TV series';
COMMENT ON TABLE series_embeddings_384 IS 'Vector embeddings (384 dim) for TV series';
COMMENT ON TABLE series_embeddings_512 IS 'Vector embeddings (512 dim) for TV series';
COMMENT ON TABLE series_embeddings_768 IS 'Vector embeddings (768 dim) for TV series';
COMMENT ON TABLE series_embeddings_1024 IS 'Vector embeddings (1024 dim) for TV series';
COMMENT ON TABLE series_embeddings_1536 IS 'Vector embeddings (1536 dim) for TV series';
COMMENT ON TABLE series_embeddings_3072 IS 'Vector embeddings (3072 dim) for TV series';

COMMENT ON TABLE episode_embeddings_256 IS 'Vector embeddings (256 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_384 IS 'Vector embeddings (384 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_512 IS 'Vector embeddings (512 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_768 IS 'Vector embeddings (768 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_1024 IS 'Vector embeddings (1024 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_1536 IS 'Vector embeddings (1536 dim) for TV episodes';
COMMENT ON TABLE episode_embeddings_3072 IS 'Vector embeddings (3072 dim) for TV episodes';

DO $$ BEGIN RAISE NOTICE '[0078] Multi-dimension embedding migration complete!'; END $$;

