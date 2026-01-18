-- Add original_language column to discovery_candidates for language filtering
-- This enables filtering discovery results by original language (e.g., 'en', 'ko', 'ja')

ALTER TABLE discovery_candidates 
  ADD COLUMN IF NOT EXISTS original_language TEXT;

-- Create index for efficient language filtering
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_language 
  ON discovery_candidates(user_id, media_type, original_language);

-- Create index for efficient year filtering
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_year 
  ON discovery_candidates(user_id, media_type, release_year);

-- Create index for efficient similarity filtering
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_similarity 
  ON discovery_candidates(user_id, media_type, similarity_score);
