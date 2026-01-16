-- Remove deprecated full-sync watch history jobs
-- These have been consolidated into the regular sync jobs which now always do full sync

DELETE FROM job_config WHERE job_name IN (
  'full-sync-movie-watch-history',
  'full-sync-series-watch-history'
);

-- Update descriptions for the regular sync jobs to reflect they now do full sync
UPDATE job_config 
SET updated_at = NOW()
WHERE job_name IN ('sync-movie-watch-history', 'sync-series-watch-history');

