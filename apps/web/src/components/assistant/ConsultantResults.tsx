import { Alert, Box, Chip, Divider, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import { useTranslation } from 'react-i18next'

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    : []
}
export function ReleaseResults({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const events = records(data.events)
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CalendarMonthOutlinedIcon color="primary" />
        <Typography fontWeight={600}>{t('encore.releaseSchedule')}</Typography>
        <Chip size="small" label={String(data.region ?? '')} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t('encore.dayPrecision')}
      </Typography>
      {Array.isArray(data.warnings) &&
        data.warnings.map((warning, i) => (
          <Alert key={i} severity="warning" sx={{ mt: 1 }}>
            {String(warning)}
          </Alert>
        ))}
      {!events.length && (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          {t('encore.noReleases')}
        </Typography>
      )}
      {events.map((event, i) => (
        <Box key={String(event.id ?? i)} sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Typography variant="caption" sx={{ minWidth: 90, color: 'primary.main', pt: 0.4 }}>
              {String(event.date)}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={600}>{String(event.title)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {event.season !== undefined ? `S${event.season} E${event.episode} · ` : ''}
                {String(event.episodeTitle ?? event.releaseType)}
              </Typography>
              <Typography
                component="a"
                href={String(event.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                color="primary.main"
              >
                {String(event.source)}
              </Typography>
            </Box>
          </Box>
          {i < events.length - 1 && <Divider sx={{ mt: 2 }} />}
        </Box>
      ))}
      {typeof data.retrievedAt === 'string' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {t('encore.checkedAt', { date: new Date(data.retrievedAt).toLocaleString() })}
        </Typography>
      )}
    </Paper>
  )
}
export function TasteResults({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography fontWeight={600} sx={{ mb: 2 }}>
        {t('encore.tasteTitle')}
      </Typography>
      {['movieTaste', 'seriesTaste'].map((key) =>
        data[key] ? (
          <Box key={key} sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary">
              {t(`encore.${key}`)}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              {String(data[key])}
            </Typography>
          </Box>
        ) : null
      )}
      <Stack direction="row" gap={1} flexWrap="wrap">
        {records(data.genres).map((genre) => (
          <Chip
            key={String(genre.genre)}
            variant="outlined"
            label={`${genre.genre} · ${t(Number(genre.weight) > 1 ? 'encore.prefer' : Number(genre.weight) < 1 ? 'encore.avoid' : 'encore.neutral')}`}
          />
        ))}
      </Stack>
      {records(data.interests).map((interest) => (
        <Typography key={String(interest.id)} variant="body2" sx={{ mt: 1.5 }}>
          {String(interest.interest_text)}
        </Typography>
      ))}
      {!data.movieTaste && !data.seriesTaste && !records(data.genres).length && (
        <Typography color="text.secondary">{t('encore.noTaste')}</Typography>
      )}
    </Paper>
  )
}
export function LibraryGroupsResult({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const franchises = records(data.franchises)
  return (
    <Stack spacing={1.5}>
      {['movieGenres', 'seriesGenres'].map(
        (key) =>
          records(data[key]).length > 0 && (
            <Paper variant="outlined" key={key} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography fontWeight={600} sx={{ mb: 1.5 }}>
                {t(key === 'movieGenres' ? 'assistantToolUi.movies' : 'assistantToolUi.tvSeries')}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {records(data[key]).map((genre) => (
                  <Chip
                    key={String(genre.genre)}
                    variant="outlined"
                    label={`${genre.genre} · ${genre.count}`}
                  />
                ))}
              </Stack>
            </Paper>
          )
      )}
      {franchises.map((item) => (
        <Paper key={String(item.name)} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography fontWeight={600}>{String(item.name)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('encore.franchiseProgress', {
              watched: Number(item.watchedCount),
              total: Number(item.movieCount),
            })}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Number(item.progress) || 0)}
            sx={{ mt: 1, borderRadius: 2 }}
          />
        </Paper>
      ))}
    </Stack>
  )
}
function Narrative({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (depth > 3 || value == null) return null
  if (typeof value === 'string' || typeof value === 'number')
    return (
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.7 }}>
        {String(value)}
      </Typography>
    )
  if (Array.isArray(value))
    return (
      <Box component="ul" sx={{ paddingInlineStart: 2 }}>
        {value.slice(0, 20).map((v, i) => (
          <Box component="li" key={i}>
            <Narrative value={v} depth={depth + 1} />
          </Box>
        ))}
      </Box>
    )
  if (typeof value === 'object')
    return (
      <Stack spacing={1}>
        {Object.entries(value)
          .filter(([key]) => !['id', 'isAdmin', 'topic'].includes(key))
          .map(([key, v]) => (
            <Narrative key={key} value={v} depth={depth + 1} />
          ))}
      </Stack>
    )
  return null
}
export function InformationResult({ data }: { data: Record<string, unknown> }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Narrative value={data.help ?? data.generalHelp ?? data} />
    </Paper>
  )
}
