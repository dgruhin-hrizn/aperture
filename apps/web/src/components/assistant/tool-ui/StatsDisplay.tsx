import { Box, Typography, LinearProgress, Stack, type SxProps, type Theme } from '@mui/material'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import TvOutlinedIcon from '@mui/icons-material/TvOutlined'
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ToolCard, ToolPreview } from '../ToolCard'
import type { StatsData, StudiosData } from './types'

const metricsGrid: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
  gap: 1,
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon?: ReactNode
  label: string
  value: string | number
  note?: string
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        gap={0.5}
        alignItems="center"
        sx={{ color: 'primary.main', '& svg': { flexShrink: 0 } }}
      >
        {icon}
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
          {label}
        </Typography>
      </Stack>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, mt: 0.25 }}
      >
        {value}
      </Typography>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  )
}

export function StatsDisplay({ data }: { data: StatsData }) {
  const { t } = useTranslation()
  const maxGenreCount = data.topGenres?.reduce((max, genre) => Math.max(max, genre.count), 0) || 1
  return (
    <Stack gap={1}>
      <ToolCard variant="outlined" sx={metricsGrid}>
        <Metric
          icon={<MovieOutlinedIcon fontSize="small" />}
          label={t('assistantToolUi.movies')}
          value={data.movieCount.toLocaleString()}
        />
        <Metric
          icon={<TvOutlinedIcon fontSize="small" />}
          label={t('assistantToolUi.tvSeries')}
          value={data.seriesCount.toLocaleString()}
          note={
            data.episodeCount !== undefined
              ? t('assistantToolUi.episodesLabel', { count: data.episodeCount })
              : undefined
          }
        />
        {data.totalRuntimeFormatted && (
          <Metric
            icon={<AccessTimeRoundedIcon fontSize="small" />}
            label={t('assistantToolUi.totalRuntime')}
            value={data.totalRuntimeFormatted}
          />
        )}
        {data.averageRating != null && (
          <Metric
            icon={<StarOutlineRoundedIcon fontSize="small" />}
            label={t('assistantToolUi.avgRating')}
            value={Number(data.averageRating).toFixed(1)}
          />
        )}
      </ToolCard>
      {data.watchStats && (
        <ToolCard variant="outlined">
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            {t('assistantToolUi.yourActivity')}
          </Typography>
          <Box sx={metricsGrid}>
            <Metric
              label={t('assistantToolUi.moviesWatched')}
              value={data.watchStats.moviesWatched}
            />
            <Metric
              label={t('assistantToolUi.seriesStarted')}
              value={data.watchStats.seriesStarted}
            />
            <Metric
              label={t('assistantToolUi.totalPlays')}
              value={data.watchStats.totalPlayCount}
            />
            {data.ratingStats && (
              <Metric
                label={t('assistantToolUi.titlesRated')}
                value={data.ratingStats.totalRated}
              />
            )}
          </Box>
        </ToolCard>
      )}
      {!!data.topGenres?.length && (
        <ToolCard variant="outlined">
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            {t('assistantToolUi.topGenres')}
          </Typography>
          <ToolPreview limit={5}>
            {data.topGenres.map((genre) => (
              <Box key={genre.genre}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2">{genre.genre}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {genre.count}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(genre.count / maxGenreCount) * 100}
                  aria-label={genre.genre}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            ))}
          </ToolPreview>
        </ToolCard>
      )}
    </Stack>
  )
}

export function StudiosDisplay({ data }: { data: StudiosData }) {
  const { t } = useTranslation()
  const groups = [
    {
      title: t('assistantToolUi.topMovieStudios'),
      items: data.studios,
      countKey: 'assistantToolUi.studioMovieCount',
    },
    {
      title: t('assistantToolUi.topTvNetworks'),
      items: data.networks,
      countKey: 'assistantToolUi.networkSeriesCount',
    },
  ]
  return (
    <Stack gap={1}>
      {groups.map(({ title, items, countKey }) =>
        items?.length ? (
          <ToolCard variant="outlined" key={title}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {title}
            </Typography>
            <ToolPreview limit={3}>
              {items.map((item) => (
                <Box
                  key={item.name}
                  sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}
                >
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    alignItems="baseline"
                    justifyContent="space-between"
                    gap={0.5}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={650}
                      sx={{ flex: '1 1 120px', minWidth: 0 }}
                    >
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(countKey, {
                        count: 'movieCount' in item ? item.movieCount : item.seriesCount,
                      })}
                    </Typography>
                  </Stack>
                  {item.topTitles.length > 0 && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      {item.topTitles.map((entry) => entry.title).join(', ')}
                    </Typography>
                  )}
                </Box>
              ))}
            </ToolPreview>
          </ToolCard>
        ) : null
      )}
    </Stack>
  )
}
