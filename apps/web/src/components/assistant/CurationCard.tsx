import { ToolCard, ToolCardHeading, ToolPreview } from './ToolCard'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'
import { useTranslation } from 'react-i18next'
import type { EncoreCuration, CurationRun } from '@aperture/core/encore'
export function CurationCard({
  curation,
  runs = [],
  busy,
  onEdit,
  onControl,
}: {
  curation: EncoreCuration
  runs?: CurationRun[]
  busy: boolean
  onEdit?: (curation: EncoreCuration) => void
  onControl: (id: string, operation: 'enable' | 'pause' | 'run' | 'delete') => Promise<unknown>
}) {
  const { t } = useTranslation(),
    recipe = curation.recipe,
    last = runs.find((r) => r.curation_id === curation.id)
  const format = (value: string) =>
    new Date(value).toLocaleString(undefined, { timeZone: curation.schedule.timezone })
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, curation.schedule.day))
  )
  const receipt = last?.result?.receipt as
    | { add?: unknown[]; remove?: unknown[]; manualAdditions?: unknown[] }
    | undefined
  const selected = (last?.result?.selected ?? []) as Array<{ id: string; title: string }>
  return (
    <ToolCard variant="outlined">
      <ToolCardHeading
        icon={<AutorenewOutlinedIcon fontSize="small" />}
        title={curation.name}
        status={
          <Chip
            size="small"
            color={curation.enabled ? 'success' : 'default'}
            label={t(curation.enabled ? 'encore.curationEnabled' : 'encore.curationPaused')}
          />
        }
      />
      <Typography variant="body2" sx={{ mt: 1 }}>
        {recipe.concept ??
          recipe.seriesName ??
          t(recipe.mediaType === 'movies' ? 'encore.curationMovies' : 'encore.curationEpisodes')}
      </Typography>
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ my: 1 }}>
        {recipe.genre && <Chip size="small" label={recipe.genre} />}
        <Chip size="small" label={t('encore.curationLimit', { count: recipe.limit })} />
        {recipe.maxRuntime && (
          <Chip size="small" label={t('encore.curationRuntime', { count: recipe.maxRuntime })} />
        )}
        {recipe.minRating !== undefined && (
          <Chip size="small" label={t('encore.curationMinScore', { score: recipe.minRating })} />
        )}
        <Chip
          size="small"
          label={t(recipe.excludeWatched ? 'encore.curationUnwatched' : 'encore.curationRewatches')}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {t(
          curation.schedule.cadence === 'daily'
            ? 'encore.curationDailyAt'
            : 'encore.curationWeeklyAt',
          { day, time: curation.schedule.time, timezone: curation.schedule.timezone }
        )}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {curation.next_run_at
          ? t('encore.curationNext', { date: format(curation.next_run_at) })
          : t('encore.curationNoNext')}
      </Typography>
      {curation.last_error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {curation.last_error}
        </Alert>
      )}
      {last && (
        <Box sx={{ mt: 1.5, bgcolor: 'action.hover', p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={600}>
            {t(`encore.curationRunStatus.${last.status}`)} ·{' '}
            {format(last.finished_at ?? last.started_at)}
          </Typography>
          {receipt && (
            <Typography variant="caption" color="text.secondary" component="div">
              {t('encore.curationRunChanges', {
                added: receipt.add?.length ?? 0,
                removed: receipt.remove?.length ?? 0,
                manual: receipt.manualAdditions?.length ?? 0,
              })}
            </Typography>
          )}
          <Box sx={{ mt: 0.5 }}>
            <ToolPreview limit={3}>
              {selected.map((item) => (
                <Typography variant="body2" key={item.id}>
                  {item.title}
                </Typography>
              ))}
            </ToolPreview>
          </Box>
          {last.error && last.error !== curation.last_error && (
            <Typography variant="body2" color="error">
              {last.error}
            </Typography>
          )}
        </Box>
      )}
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
        <Button
          variant={curation.enabled ? 'outlined' : 'contained'}
          disabled={busy}
          onClick={() =>
            void onControl(curation.id, curation.enabled ? 'pause' : 'enable').catch(() => {})
          }
        >
          {t(curation.enabled ? 'encore.pauseCuration' : 'encore.enableCuration')}
        </Button>
        <Button
          disabled={busy || !curation.enabled}
          onClick={() => void onControl(curation.id, 'run').catch(() => {})}
        >
          {t('encore.runCuration')}
        </Button>
        {onEdit && (
          <Button disabled={busy} onClick={() => onEdit(curation)}>
            {t('common.edit')}
          </Button>
        )}
        <Button
          color="error"
          disabled={busy}
          onClick={() => void onControl(curation.id, 'delete').catch(() => {})}
        >
          {t('common.delete')}
        </Button>
      </Stack>
      {!curation.enabled && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('encore.curationOptIn')}
        </Typography>
      )}
    </ToolCard>
  )
}
