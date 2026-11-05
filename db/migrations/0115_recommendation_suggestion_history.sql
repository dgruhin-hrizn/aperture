ALTER TABLE recommendation_config
  ADD COLUMN movie_repeat_cooldown_days INTEGER NOT NULL DEFAULT 180
    CHECK (movie_repeat_cooldown_days BETWEEN 1 AND 36500),
  ADD COLUMN series_repeat_cooldown_days INTEGER NOT NULL DEFAULT 180
    CHECK (series_repeat_cooldown_days BETWEEN 1 AND 36500);

CREATE TABLE recommendation_suggestion_history (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series')),
  title_key TEXT NOT NULL,
  last_suggested_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, media_type, title_key)
);

-- Use title and year to group alternate library copies, as selection does.
INSERT INTO recommendation_suggestion_history (user_id, media_type, title_key, last_suggested_at)
SELECT rr.user_id, rr.media_type,
       lower(COALESCE(m.title, s.title)) || '|' || COALESCE(NULLIF(COALESCE(m.year, s.year), 0)::text, 'unknown'),
       MAX(COALESCE(rr.completed_at, rr.created_at))
FROM recommendation_runs rr
JOIN recommendation_candidates rc ON rc.run_id = rr.id AND rc.is_selected
LEFT JOIN movies m ON rr.media_type = 'movie' AND m.id = rc.movie_id
LEFT JOIN series s ON rr.media_type = 'series' AND s.id = rc.series_id
WHERE rr.status = 'completed' AND COALESCE(m.title, s.title) IS NOT NULL
GROUP BY 1, 2, 3;
