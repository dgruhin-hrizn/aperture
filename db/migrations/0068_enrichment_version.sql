-- Enrichment Version Tracking
-- 
-- Tracks which version of the enrichment schema was used when items were enriched.
-- When migrations add new enrichment fields, bump CURRENT_ENRICHMENT_VERSION.
-- Frontend will alert users when items have outdated enrichment.
--
-- Version History:
-- v1: Initial (keywords, RT scores, awards, collection)
-- v2: Added languages, production_countries from OMDb (0067)
-- v3: Added MDBList data (letterboxd, streaming providers, keywords)

-- Store current enrichment version in system settings
INSERT INTO system_settings (key, value, description)
VALUES ('enrichment_version', '3', 'Current enrichment schema version. Bump when adding new enrichment fields.')
ON CONFLICT (key) DO UPDATE SET value = '3';

-- Track version per movie (defaults to 0 = never enriched with version tracking)
ALTER TABLE movies ADD COLUMN IF NOT EXISTS enrichment_version INT DEFAULT 0;
ALTER TABLE series ADD COLUMN IF NOT EXISTS enrichment_version INT DEFAULT 0;

-- Update enriched items to current version (they have all fields)
-- Items enriched before this migration get version 0
UPDATE movies SET enrichment_version = 3 WHERE enriched_at IS NOT NULL AND enrichment_version = 0;
UPDATE series SET enrichment_version = 3 WHERE enriched_at IS NOT NULL AND enrichment_version = 0;

-- Index for finding items needing re-enrichment
CREATE INDEX IF NOT EXISTS idx_movies_enrichment_version ON movies(enrichment_version);
CREATE INDEX IF NOT EXISTS idx_series_enrichment_version ON series(enrichment_version);

COMMENT ON COLUMN movies.enrichment_version IS 'Enrichment schema version. Compare to system_settings.enrichment_version to detect outdated items.';
COMMENT ON COLUMN series.enrichment_version IS 'Enrichment schema version. Compare to system_settings.enrichment_version to detect outdated items.';

