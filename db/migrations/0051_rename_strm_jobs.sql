-- Migration: 0051_rename_strm_jobs
-- Description: Rename STRM jobs to library sync jobs (handles both STRM and symlinks)

-- Rename movie STRM job
UPDATE job_config 
SET job_name = 'sync-movie-libraries', 
    updated_at = NOW()
WHERE job_name = 'sync-strm';

-- Rename series STRM job
UPDATE job_config 
SET job_name = 'sync-series-libraries', 
    updated_at = NOW()
WHERE job_name = 'sync-series-strm';

-- Also update job_runs history
UPDATE job_runs 
SET job_name = 'sync-movie-libraries'
WHERE job_name = 'sync-strm';

UPDATE job_runs 
SET job_name = 'sync-series-libraries'
WHERE job_name = 'sync-series-strm';


