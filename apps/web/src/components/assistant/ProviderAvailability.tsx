import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
export function ProviderAvailability({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const providers = data.watchProviders && typeof data.watchProviders === 'object' ? data.watchProviders as Record<string, unknown> : null
  return <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
    <Typography variant="subtitle2">{t('encore.streamingTitle', { region: String(data.region) })}</Typography>
    {providers ? ['subscription', 'rent', 'buy'].map((key) => {
      const names = Array.isArray(providers[key]) ? providers[key] as string[] : []
      return names.length > 0 && <Box key={key} sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary">{t(`encore.providerTypes.${key}`)}</Typography><Stack direction="row" flexWrap="wrap" gap={.5}>{names.map((name) => <Chip size="small" key={name} label={name} />)}</Stack></Box>
    }) : <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>{t('encore.noStreaming')}</Typography>}
    <Typography component="a" href={typeof providers?.link === 'string' ? providers.link : undefined} target="_blank" rel="noopener noreferrer" variant="caption" color="primary.main" sx={{ display: 'block', mt: 2 }}>{t('encore.justWatchAttribution')}</Typography>
    <Alert severity="info" sx={{ mt: 1.5 }}>{t('encore.streamingPrecision')}</Alert>
  </Paper>
}
