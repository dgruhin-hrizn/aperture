-- Migration: 0013_recommendation_runs
-- Description: Create tables for storing recommendation run artifacts (explainability)

-- Recommendation runs table
CREATE TABLE recommendation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User this run was for
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Run metadata
  run_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (run_type IN ('scheduled', 'manual', 'channel')),
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,

  -- Run statistics
  candidate_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Recommendation candidates (all candidates considered)
CREATE TABLE recommendation_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  run_id UUID NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,

  -- Position
  rank INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,

  -- Score breakdown
  final_score NUMERIC(6, 4) NOT NULL,
  similarity_score NUMERIC(6, 4),
  novelty_score NUMERIC(6, 4),
  rating_score NUMERIC(6, 4),
  diversity_score NUMERIC(6, 4),

  -- Additional scoring factors
  score_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Recommendation evidence (why a movie was recommended)
CREATE TABLE recommendation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- References
  candidate_id UUID NOT NULL REFERENCES recommendation_candidates(id) ON DELETE CASCADE,
  similar_movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,

  -- Evidence details
  similarity NUMERIC(6, 4) NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'watched'
    CHECK (evidence_type IN ('watched', 'favorite', 'highly_rated', 'recent'))
);

-- Indexes
CREATE INDEX idx_recommendation_runs_user_id ON recommendation_runs(user_id);
CREATE INDEX idx_recommendation_runs_created_at ON recommendation_runs(created_at DESC);
CREATE INDEX idx_recommendation_candidates_run_id ON recommendation_candidates(run_id);
CREATE INDEX idx_recommendation_candidates_movie_id ON recommendation_candidates(movie_id);
CREATE INDEX idx_recommendation_candidates_selected ON recommendation_candidates(run_id, is_selected)
  WHERE is_selected = TRUE;
CREATE INDEX idx_recommendation_evidence_candidate_id ON recommendation_evidence(candidate_id);

COMMENT ON TABLE recommendation_runs IS 'Records of recommendation generation runs';
COMMENT ON TABLE recommendation_candidates IS 'All movies considered during a recommendation run';
COMMENT ON COLUMN recommendation_candidates.score_breakdown IS 'Detailed breakdown of all scoring factors';
COMMENT ON TABLE recommendation_evidence IS 'Evidence explaining why each movie was recommended';
COMMENT ON COLUMN recommendation_evidence.evidence_type IS 'Type of evidence: watched, favorite, etc.';



