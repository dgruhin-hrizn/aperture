-- Migration: 0108_gap_results_status
-- Description: Store ALL released collection parts (not just missing) with library + Seerr status.
--              This eliminates live Seerr HTTP calls from the gap analysis display path.

-- Wipe existing runs/results since the schema semantics change (results now include ALL parts).
DELETE FROM gap_analysis_runs;

ALTER TABLE gap_analysis_results
  ADD COLUMN in_library BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN seerr_status TEXT NOT NULL DEFAULT 'none'
    CHECK (seerr_status IN ('none', 'requested', 'processing', 'available'));

CREATE INDEX idx_gap_results_status ON gap_analysis_results (run_id, in_library, seerr_status);
