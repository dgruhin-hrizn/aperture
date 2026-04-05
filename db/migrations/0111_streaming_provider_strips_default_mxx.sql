-- US JustWatch snapshot uses short_name "mxx" for HBO Max (Max), not "hbo".

UPDATE system_settings
SET value = 'nfx,dnp,mxx',
    description = 'Comma-separated JustWatch package short_name codes for per-provider strips (US example: nfx,dnp,mxx). Country-specific; see admin reference list.'
WHERE key = 'streaming_discovery_provider_strips'
  AND value = 'nfx,dnp,hbo';
