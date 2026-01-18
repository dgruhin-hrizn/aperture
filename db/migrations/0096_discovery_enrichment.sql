-- Add is_enriched flag to track which candidates have full metadata
-- This supports lazy enrichment where only top candidates get full cast/crew info

ALTER TABLE discovery_candidates 
ADD COLUMN IF NOT EXISTS is_enriched BOOLEAN DEFAULT FALSE;

-- Index for efficient queries that filter by enrichment status
CREATE INDEX IF NOT EXISTS idx_discovery_enriched 
ON discovery_candidates(user_id, media_type, is_enriched, final_score DESC);

-- Update existing candidates to be marked as enriched (they have full data)
UPDATE discovery_candidates SET is_enriched = TRUE WHERE is_enriched IS NULL;

-- Ensure the column has a default for new records
ALTER TABLE discovery_candidates 
ALTER COLUMN is_enriched SET DEFAULT FALSE;
