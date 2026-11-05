import { Box, Chip, Link, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { estimateChatStyles } from './chatCost'

export function ChatCostBreakdown({
  estimates, official,
}: {
  estimates: ReturnType<typeof estimateChatStyles>
  official: boolean
}) {
  const { t } = useTranslation()
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {t('settingsCostEstimator.chatStyles.title')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {estimates.map(({ preset, isDefault, samples, cost, reasoning }) => (
          <Box key={preset} sx={{ flex: 1, minWidth: 0, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="body2" fontWeight={600}>{t(`reasoningPresets.${preset}.label`)}</Typography>
              {isDefault && <Chip size="small" label={t('settingsCostEstimator.chatStyles.default')} />}
            </Stack>
            <Typography variant="body2">
              {cost === null
                ? t('settingsCostEstimator.priceUnknown')
                : t('settingsCostEstimator.chatStyles.perReply', { cost: `$${cost.toFixed(6)}` })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {samples > 0
                ? t('settingsCostEstimator.chatStyles.measured', { count: samples, tokens: Math.round(reasoning).toLocaleString() })
                : t('settingsCostEstimator.chatStyles.estimated')}
            </Typography>
          </Box>
        ))}
      </Stack>
      {official && (
        <Link variant="caption" href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer" sx={{ display: 'inline-block', mt: 0.75 }}>
          {t('settingsCostEstimator.chatStyles.official')}
        </Link>
      )}
    </Box>
  )
}
