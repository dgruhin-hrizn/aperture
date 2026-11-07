-- Legacy interval rows without minute offsets ran together at :00. Repair only
-- unset offsets; preserve administrators' explicit schedules (including :00).
UPDATE job_config AS job
SET schedule_minute = defaults.minute
FROM (VALUES
  ('sync-series-watch-history', 5),
  ('sync-movie-watch-history', 15),
  ('sync-watching-favorites', 45),
  ('sync-series', 10),
  ('sync-movie-libraries', 20),
  ('sync-series-libraries', 30),
  ('generate-movie-embeddings', 10),
  ('generate-series-embeddings', 20),
  ('sync-trakt-ratings', 30)
) AS defaults(name, minute)
WHERE job.job_name = defaults.name
  AND job.schedule_type = 'interval'
  AND job.schedule_interval_minutes IS NULL
  AND job.schedule_minute IS NULL;
