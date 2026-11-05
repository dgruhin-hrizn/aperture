import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useTranslation } from 'react-i18next'
import { ToolCard, ToolCardHeading, ToolPreview } from './ToolCard'

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    : []
}

export function ReleaseResults({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const events = records(data.events)
  return (
    <ToolCard variant="outlined">
      <ToolCardHeading
        icon={<CalendarMonthOutlinedIcon fontSize="small" />}
        title={t(
          data.mode === 'movies'
            ? 'encore.movieReleaseSchedule'
            : data.mode === 'following'
              ? 'encore.followedReleaseSchedule'
              : 'encore.releaseSchedule'
        )}
        status={typeof data.region === 'string' && <Chip size="small" label={data.region} />}
      />
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {typeof data.startDate === 'string' && typeof data.endDate === 'string' && (
          <Typography variant="caption" color="text.secondary">
            {data.startDate === data.endDate
              ? data.startDate
              : `${data.startDate} – ${data.endDate}`}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('encore.dayPrecision')}
        </Typography>
      </Stack>
      {Array.isArray(data.warnings) &&
        data.warnings.map((warning, i) => (
          <Alert key={i} severity="warning" sx={{ mt: 1, py: 0 }}>
            {String(warning)}
          </Alert>
        ))}
      {!events.length && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('encore.noReleases')}
        </Typography>
      )}
      <Box
        sx={{
          mt: 1,
          '& [data-release-row] + [data-release-row]': {
            borderTop: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <ToolPreview limit={5}>
          {events.map((event, i) => {
            const detail = [
              event.season !== undefined && `S${event.season} E${event.episode}`,
              event.episodeTitle ?? event.releaseType,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <Box
                key={String(event.id ?? i)}
                data-release-row
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 0.5,
                  py: 0.5,
                }}
              >
                <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={650}>
                    {String(event.title)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    <Box component="time" color="primary.main" dateTime={String(event.date)}>
                      {String(event.date)}
                    </Box>
                    {detail && ` · ${detail}`}
                  </Typography>
                </Box>
                {typeof event.sourceUrl === 'string' && (
                  <Button
                    size="small"
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${event.source} · ${event.title}`}
                    endIcon={<OpenInNewRoundedIcon />}
                    sx={{ minHeight: 44, minWidth: 44, maxWidth: '100%' }}
                  >
                    {String(event.source)}
                  </Button>
                )}
              </Box>
            )
          })}
        </ToolPreview>
      </Box>
      {typeof data.retrievedAt === 'string' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {t('encore.checkedAt', { date: new Date(data.retrievedAt).toLocaleString() })}
        </Typography>
      )}
    </ToolCard>
  )
}

export function TasteResults({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const genres = records(data.genres)
  const interests = records(data.interests)
  return (
    <ToolCard variant="outlined">
      <Typography variant="subtitle1" fontWeight={650}>
        {t('encore.tasteTitle')}
      </Typography>
      <Stack gap={1} sx={{ mt: 0.5 }}>
        {['movieTaste', 'seriesTaste'].map((key) =>
          data[key] ? (
            <Box key={key}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {t(`encore.${key}`)}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                {String(data[key])}
              </Typography>
            </Box>
          ) : null
        )}
        {genres.length > 0 && (
          <Box>
            <ToolPreview limit={6} chips>
              {genres.map((genre) => (
                <Chip
                  key={String(genre.genre)}
                  variant="outlined"
                  size="small"
                  label={`${genre.genre} · ${t(Number(genre.weight) > 1 ? 'encore.prefer' : Number(genre.weight) < 1 ? 'encore.avoid' : 'encore.neutral')}`}
                />
              ))}
            </ToolPreview>
          </Box>
        )}
        {interests.length > 0 && (
          <Box>
            <ToolPreview limit={3}>
              {interests.map((interest) => (
                <Typography key={String(interest.id)} variant="body2">
                  {String(interest.interest_text)}
                </Typography>
              ))}
            </ToolPreview>
          </Box>
        )}
        {!data.movieTaste && !data.seriesTaste && !genres.length && !interests.length && (
          <Typography variant="body2" color="text.secondary">
            {t('encore.noTaste')}
          </Typography>
        )}
      </Stack>
    </ToolCard>
  )
}

export function LibraryGroupsResult({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const franchises = records(data.franchises)
  return (
    <Stack gap={1}>
      {['movieGenres', 'seriesGenres'].map((key) => {
        const genres = records(data[key])
        if (!genres.length) return null
        return (
          <ToolCard variant="outlined" key={key}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t(key === 'movieGenres' ? 'assistantToolUi.movies' : 'assistantToolUi.tvSeries')}
            </Typography>
            <ToolPreview limit={6} chips>
              {genres.map((genre) => (
                <Chip
                  key={String(genre.genre)}
                  size="small"
                  variant="outlined"
                  label={`${genre.genre} · ${genre.count}`}
                />
              ))}
            </ToolPreview>
          </ToolCard>
        )
      })}
      {franchises.length > 0 && (
        <ToolCard variant="outlined">
          <ToolPreview>
            {franchises.map((item) => (
              <Box key={String(item.name)} sx={{ py: 0.5 }}>
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  alignItems="baseline"
                  gap={0.5}
                  justifyContent="space-between"
                >
                  <Typography variant="body2" fontWeight={650}>
                    {String(item.name)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('encore.franchiseProgress', {
                      watched: Number(item.watchedCount),
                      total: Number(item.movieCount),
                    })}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  aria-label={String(item.name)}
                  value={Math.max(0, Math.min(100, Number(item.progress) || 0))}
                  sx={{ mt: 0.5, borderRadius: 2 }}
                />
              </Box>
            ))}
          </ToolPreview>
        </ToolCard>
      )}
    </Stack>
  )
}

function Narrative({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (depth > 3 || value == null) return null
  if (typeof value === 'string' || typeof value === 'number')
    return (
      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
        {String(value)}
      </Typography>
    )
  if (Array.isArray(value))
    return (
      <Box component="ul" sx={{ my: 0, paddingInlineStart: 2 }}>
        {value.slice(0, 20).map((v, i) => (
          <Box component="li" key={i}>
            <Narrative value={v} depth={depth + 1} />
          </Box>
        ))}
      </Box>
    )
  if (typeof value === 'object')
    return (
      <Stack gap={0.5}>
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
  const value = data.help ?? data.generalHelp ?? data
  const { title, description, overview, ...sections } =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const summary = description ?? overview
  return (
    <ToolCard variant="outlined">
      {typeof title === 'string' && (
        <Typography variant="subtitle1" fontWeight={650}>
          {title}
        </Typography>
      )}
      <Narrative value={summary} />
      <ToolPreview limit={summary ? 0 : 4}>
        {Object.entries(sections)
          .filter(([key, section]) => section != null && !['id', 'isAdmin', 'topic'].includes(key))
          .map(([key, section]) => (
            <Narrative key={key} value={section} depth={1} />
          ))}
        {(typeof value !== 'object' || Array.isArray(value)) && value != null && (
          <Narrative value={value} />
        )}
      </ToolPreview>
    </ToolCard>
  )
}
