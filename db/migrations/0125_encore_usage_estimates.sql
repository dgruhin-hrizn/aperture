-- Daily token totals for estimator averages. No conversation or user identifiers.
CREATE TABLE encore_usage_daily (
  day DATE NOT NULL,
  model_key TEXT NOT NULL,
  preset TEXT NOT NULL CHECK (preset IN ('quick', 'standard', 'expanded')),
  samples INTEGER NOT NULL,
  input_tokens BIGINT NOT NULL,
  cached_tokens BIGINT NOT NULL,
  cache_write_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  reasoning_tokens BIGINT NOT NULL,
  PRIMARY KEY (model_key, preset, day)
);
