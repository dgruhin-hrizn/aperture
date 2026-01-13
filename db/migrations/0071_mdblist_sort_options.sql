-- Add sort option columns for MDBList-sourced Top Picks
-- Allows users to choose how list items are ranked (score, imdb rating, etc.)

ALTER TABLE top_picks_config
  ADD COLUMN mdblist_movies_sort TEXT NOT NULL DEFAULT 'score';

ALTER TABLE top_picks_config
  ADD COLUMN mdblist_series_sort TEXT NOT NULL DEFAULT 'score';

COMMENT ON COLUMN top_picks_config.mdblist_movies_sort IS 'Sort order for MDBList movie rankings: score, score_average, imdbrating, imdbvotes, imdbpopular, tmdbpopular, rtomatoes, metacritic';
COMMENT ON COLUMN top_picks_config.mdblist_series_sort IS 'Sort order for MDBList series rankings: score, score_average, imdbrating, imdbvotes, imdbpopular, tmdbpopular, rtomatoes, metacritic';

