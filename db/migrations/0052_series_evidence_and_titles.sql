-- Migration: 0052_series_evidence_and_titles
-- Description: Add series support to recommendation_evidence table and library title templates

-- ============================================================================
-- Part 1: Series Evidence Support
-- ============================================================================

-- Make similar_movie_id nullable (was NOT NULL before)
ALTER TABLE recommendation_evidence ALTER COLUMN similar_movie_id DROP NOT NULL;

-- Add similar_series_id column for series evidence
ALTER TABLE recommendation_evidence ADD COLUMN similar_series_id UUID REFERENCES series(id) ON DELETE CASCADE;

-- Add check constraint: must have either movie or series reference
ALTER TABLE recommendation_evidence ADD CONSTRAINT evidence_has_reference 
  CHECK (similar_movie_id IS NOT NULL OR similar_series_id IS NOT NULL);

-- Index for series lookups
CREATE INDEX idx_recommendation_evidence_series ON recommendation_evidence(similar_series_id) 
  WHERE similar_series_id IS NOT NULL;

COMMENT ON COLUMN recommendation_evidence.similar_series_id IS 'Reference to similar watched series (for series recommendations)';

-- ============================================================================
-- Part 2: Library Title Templates
-- ============================================================================

-- Default title templates for AI recommendation libraries
INSERT INTO system_settings (key, value, description) VALUES
  ('ai_library_movies_title_template', '{{username}}''s AI Picks - Movies', 'Default title template for AI movie libraries. Supports: {{username}}, {{type}}, {{count}}, {{date}}'),
  ('ai_library_series_title_template', '{{username}}''s AI Picks - TV Series', 'Default title template for AI series libraries. Supports: {{username}}, {{type}}, {{count}}, {{date}}')
ON CONFLICT (key) DO NOTHING;


