-- Migration: Update embedding model names to include provider prefix
-- This migration updates existing embeddings to use the new model name format (provider:model)
-- so they are recognized by the new multi-provider AI system.
-- Processes in batches for real-time progress feedback

-- Create indexes first to speed up the migration significantly
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model);
CREATE INDEX IF NOT EXISTS idx_series_embeddings_model ON series_embeddings(model);
CREATE INDEX IF NOT EXISTS idx_episode_embeddings_model ON episode_embeddings(model);

DO $$
DECLARE
  batch_size INTEGER := 500;
  total_count INTEGER;
  processed INTEGER := 0;
  batch_affected INTEGER;
BEGIN
  RAISE NOTICE '[0077] Starting embedding model name migration...';
  
  -- === MOVIE EMBEDDINGS ===
  -- Count total needing migration
  SELECT COUNT(*) INTO total_count FROM embeddings 
  WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002');
  
  IF total_count > 0 THEN
    RAISE NOTICE '[0077] Processing % movie embeddings...', total_count;
    
    -- Delete duplicates first (usually few)
    DELETE FROM embeddings e1
    USING embeddings e2
    WHERE e1.model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
      AND e2.movie_id = e1.movie_id
      AND e2.model = 'openai:' || e1.model;
    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    IF batch_affected > 0 THEN
      RAISE NOTICE '[0077]   Removed % duplicates', batch_affected;
    END IF;
    
    -- Update in batches
    processed := 0;
    LOOP
      UPDATE embeddings
      SET model = 'openai:' || model
      WHERE id IN (
        SELECT id FROM embeddings 
        WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
        LIMIT batch_size
      );
      GET DIAGNOSTICS batch_affected = ROW_COUNT;
      EXIT WHEN batch_affected = 0;
      processed := processed + batch_affected;
      RAISE NOTICE '[0077]   Movies: %/% updated', processed, total_count;
    END LOOP;
  ELSE
    RAISE NOTICE '[0077] No movie embeddings need migration';
  END IF;

  -- === SERIES EMBEDDINGS ===
  SELECT COUNT(*) INTO total_count FROM series_embeddings 
  WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002');
  
  IF total_count > 0 THEN
    RAISE NOTICE '[0077] Processing % series embeddings...', total_count;
    
    DELETE FROM series_embeddings e1
    USING series_embeddings e2
    WHERE e1.model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
      AND e2.series_id = e1.series_id
      AND e2.model = 'openai:' || e1.model;
    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    IF batch_affected > 0 THEN
      RAISE NOTICE '[0077]   Removed % duplicates', batch_affected;
    END IF;
    
    processed := 0;
    LOOP
      UPDATE series_embeddings
      SET model = 'openai:' || model
      WHERE id IN (
        SELECT id FROM series_embeddings 
        WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
        LIMIT batch_size
      );
      GET DIAGNOSTICS batch_affected = ROW_COUNT;
      EXIT WHEN batch_affected = 0;
      processed := processed + batch_affected;
      RAISE NOTICE '[0077]   Series: %/% updated', processed, total_count;
    END LOOP;
  ELSE
    RAISE NOTICE '[0077] No series embeddings need migration';
  END IF;

  -- === EPISODE EMBEDDINGS ===
  SELECT COUNT(*) INTO total_count FROM episode_embeddings 
  WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002');
  
  IF total_count > 0 THEN
    RAISE NOTICE '[0077] Processing % episode embeddings...', total_count;
    
    DELETE FROM episode_embeddings e1
    USING episode_embeddings e2
    WHERE e1.model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
      AND e2.episode_id = e1.episode_id
      AND e2.model = 'openai:' || e1.model;
    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    IF batch_affected > 0 THEN
      RAISE NOTICE '[0077]   Removed % duplicates', batch_affected;
    END IF;
    
    processed := 0;
    LOOP
      UPDATE episode_embeddings
      SET model = 'openai:' || model
      WHERE id IN (
        SELECT id FROM episode_embeddings 
        WHERE model IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')
        LIMIT batch_size
      );
      GET DIAGNOSTICS batch_affected = ROW_COUNT;
      EXIT WHEN batch_affected = 0;
      processed := processed + batch_affected;
      RAISE NOTICE '[0077]   Episodes: %/% updated', processed, total_count;
    END LOOP;
  ELSE
    RAISE NOTICE '[0077] No episode embeddings need migration';
  END IF;

  RAISE NOTICE '[0077] ✅ Embedding model name migration complete!';
END $$;

