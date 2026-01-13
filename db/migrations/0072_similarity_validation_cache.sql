-- Migration: Similarity validation cache for AI-validated connections
-- This table caches AI validation results to reduce future API calls

-- Create cache table for AI connection validations
CREATE TABLE IF NOT EXISTS similarity_validation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('movie', 'series')),
  target_type TEXT NOT NULL CHECK (target_type IN ('movie', 'series')),
  is_valid BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_id, target_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_similarity_cache_lookup 
ON similarity_validation_cache(source_id, target_id);

-- Index for reverse lookups (check both directions)
CREATE INDEX IF NOT EXISTS idx_similarity_cache_reverse 
ON similarity_validation_cache(target_id, source_id);

-- Comment on table
COMMENT ON TABLE similarity_validation_cache IS 
'Caches AI validation results for similarity connections to reduce API costs';

