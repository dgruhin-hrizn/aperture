-- JustWatch chart response cache (GraphQL popular/search payloads) + streaming discovery feature flag

CREATE TABLE justwatch_chart_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_justwatch_chart_cache_fetched_at ON justwatch_chart_cache (fetched_at DESC);

COMMENT ON TABLE justwatch_chart_cache IS 'Cached JustWatch GraphQL responses; TTL enforced in application layer';

INSERT INTO system_settings (key, value, description)
VALUES (
  'streaming_discovery_enabled',
  'false',
  'When true, Discovery shows JustWatch streaming charts (also requires user discover_enabled).'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES (
  'streaming_discovery_provider_strips',
  'nfx,dnp,hbo',
  'Comma-separated JustWatch package technicalName values for per-provider strips on Discovery (e.g. nfx,dnp,hbo).'
)
ON CONFLICT (key) DO NOTHING;
