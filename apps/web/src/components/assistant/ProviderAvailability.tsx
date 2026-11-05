import { ToolCard } from './ToolCard'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
export function ProviderAvailability({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const providers =
    data.watchProviders && typeof data.watchProviders === 'object'
      ? (data.watchProviders as Record<string, unknown>)
      : null
  return (
    <ToolCard variant="outlined">
      <Typography variant="subtitle2">
        {t('encore.streamingTitle', { region: String(data.region) })}
      </Typography>
      {providers ? (
        ['subscription', 'rent', 'buy'].map((key) => {
          const names = Array.isArray(providers[key]) ? (providers[key] as string[]) : []
          return (
            names.length > 0 && (
              <Box key={key} sx={{ mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  {t(`encore.providerTypes.${key}`)}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {names.map((name) => (
                    <Chip size="small" key={name} label={name} />
                  ))}
                </Stack>
              </Box>
            )
          )
        })
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('encore.noStreaming')}
        </Typography>
      )}
      {typeof providers?.link === 'string' ? (
        <Button
          size="small"
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ minHeight: 44, maxWidth: '100%', textAlign: 'start' }}
        >
          {t('encore.justWatchAttribution')}
        </Button>
      ) : (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
          {t('encore.justWatchAttribution')}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
        {t('encore.streamingPrecision')}
      </Typography>
    </ToolCard>
  )
}
