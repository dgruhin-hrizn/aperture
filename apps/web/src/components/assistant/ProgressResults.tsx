import { Alert, Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ContentCarousel } from './tool-ui'
import type { ContentItem } from './tool-ui'
export function ProgressResults({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  if (data.kind === 'episodes') {
    const episodes = data.episodes as Array<{
      id: string
      title: string
      season_number: number
      episode_number: number
      runtime_minutes: number | null
    }>
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography fontWeight={600}>{t('encore.nextEpisodes')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('encore.episodeAvailability')}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {episodes.map((episode) => (
            <Box key={episode.id}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Chip size="small" label={`S${episode.season_number} E${episode.episode_number}`} />
                <Typography variant="body2" fontWeight={600}>
                  {episode.title}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {episode.runtime_minutes
                  ? t('encore.minutes', { count: episode.runtime_minutes })
                  : t('encore.unplaced.unknownRuntime')}
              </Typography>
            </Box>
          ))}
        </Stack>
        {!episodes.length && <Typography sx={{ mt: 2 }}>{t('encore.noNextEpisodes')}</Typography>}
      </Paper>
    )
  }
  const movies = data.movies as Array<{
    id: string
    title: string
    image: string | null
    overview?: string
    year: number | null
    rating: number | null
    watched: boolean
    detailsUrl: string
    playUrl: string | null
  }>
  const items: ContentItem[] = movies.map((movie) => ({
    id: movie.id,
    type: 'movie',
    name: movie.title,
    image: movie.image,
    overview: movie.overview,
    rating: movie.rating === null ? null : Number(movie.rating),
    subtitle: [
      movie.year,
      movie.watched ? t('assistantToolUi.watched') : t('encore.curationUnwatched'),
    ]
      .filter(Boolean)
      .join(' · '),
    actions: [
      { id: 'details', label: t('assistantToolUi.viewDetails'), href: movie.detailsUrl },
      ...(movie.playUrl
        ? [{ id: 'play', label: t('assistantToolUi.playOnEmby'), href: movie.playUrl }]
        : []),
    ],
  }))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography fontWeight={600}>{String(data.franchiseName)}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('encore.franchiseProgress', {
            watched: Number(data.watchedCount),
            total: Number(data.totalCount),
          })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, Number(data.progress) || 0))}
          sx={{ mt: 1.5, borderRadius: 2 }}
        />
        {data.truncated === true && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {t('encore.franchiseTruncated')}
          </Alert>
        )}
      </Paper>
      <ContentCarousel data={{ id: String(data.id), items }} />
    </Box>
  )
}
