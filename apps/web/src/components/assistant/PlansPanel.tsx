import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useWorkbench } from './hooks/useWorkbench'
import { PlanCard } from './PlanCard'
export function PlansPanel() {
  const { t } = useTranslation(),
    state = useWorkbench()
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2} sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h5">{t('encore.plansTitle')}</Typography>
        <Typography color="text.secondary">{t('encore.plansIntro')}</Typography>
        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.loading ? (
          <CircularProgress size={24} />
        ) : state.data.plans.length ? (
          state.data.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} busy={state.busy} command={state.command} />
          ))
        ) : (
          <Alert severity="info">{t('encore.plansEmpty')}</Alert>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('encore.calendarCopy')}
        </Typography>
      </Stack>
    </Box>
  )
}
