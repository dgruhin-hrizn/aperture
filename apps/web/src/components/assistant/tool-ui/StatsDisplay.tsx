/**
 * Stats display for Tool UI
 * Shows library statistics and user activity
 */
import { Box, Typography, Paper, Chip, LinearProgress } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import StarIcon from '@mui/icons-material/Star'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { useTranslation } from 'react-i18next'
import type { StatsData, StudiosData } from './types'

interface StatsDisplayProps {
  data: StatsData
}

export function StatsDisplay({ data }: StatsDisplayProps) {
  const { t } = useTranslation()
  const maxGenreCount = data.topGenres?.reduce((max, g) => Math.max(max, g.count), 0) || 1

  return (
    <Box sx={{ my: 2 }}>
      {/* Main stats grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 1.5,
          mb: 2,
        }}
      >
        {/* Movies */}
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <MovieIcon sx={{ color: '#818cf8' }} />
            <Typography variant="caption" color="text.secondary">{t('assistantToolUi.movies')}</Typography>
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#fff' }}>
            {data.movieCount.toLocaleString()}
          </Typography>
        </Paper>

        {/* Series */}
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TvIcon sx={{ color: '#10b981' }} />
            <Typography variant="caption" color="text.secondary">{t('assistantToolUi.tvSeries')}</Typography>
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#fff' }}>
            {data.seriesCount.toLocaleString()}
          </Typography>
          {data.episodeCount !== undefined && (
            <Typography variant="caption" color="text.secondary">
              {t('assistantToolUi.episodesLabel', { count: data.episodeCount })}
            </Typography>
          )}
        </Paper>

        {/* Runtime */}
        {data.totalRuntimeFormatted && (
          <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccessTimeIcon sx={{ color: '#f59e0b' }} />
              <Typography variant="caption" color="text.secondary">{t('assistantToolUi.totalRuntime')}</Typography>
            </Box>
            <Typography variant="body1" fontWeight={600} sx={{ color: '#fff' }}>
              {data.totalRuntimeFormatted}
            </Typography>
          </Paper>
        )}

        {/* Average Rating */}
        {data.averageRating !== null && data.averageRating !== undefined && (
          <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StarIcon sx={{ color: '#ffc107' }} />
              <Typography variant="caption" color="text.secondary">{t('assistantToolUi.avgRating')}</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} sx={{ color: '#fff' }}>
              {Number(data.averageRating).toFixed(1)}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* User activity */}
      {data.watchStats && (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: '#e4e4e7' }}>
            {t('assistantToolUi.yourActivity')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('assistantToolUi.moviesWatched')}</Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#818cf8' }}>
                {data.watchStats.moviesWatched}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('assistantToolUi.seriesStarted')}</Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#10b981' }}>
                {data.watchStats.seriesStarted}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('assistantToolUi.totalPlays')}</Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#f59e0b' }}>
                {data.watchStats.totalPlayCount}
              </Typography>
            </Box>
            {data.ratingStats && (
              <Box>
                <Typography variant="caption" color="text.secondary">{t('assistantToolUi.titlesRated')}</Typography>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#ec4899' }}>
                  {data.ratingStats.totalRated}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Top genres */}
      {data.topGenres && data.topGenres.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: '#e4e4e7' }}>
            {t('assistantToolUi.topGenres')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.topGenres.slice(0, 5).map((genre) => (
              <Box key={genre.genre}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#e4e4e7' }}>
                    {genre.genre}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {genre.count}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(genre.count / maxGenreCount) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: '#2a2a2a',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  )
}

interface StudiosDisplayProps {
  data: StudiosData
}

export function StudiosDisplay({ data }: StudiosDisplayProps) {
  const { t } = useTranslation()
  return (
    <Box sx={{ my: 2 }}>
      {data.studios && data.studios.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: '#e4e4e7' }}>
            {t('assistantToolUi.topMovieStudios')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.studios.map((studio) => (
              <Box key={studio.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>
                    {studio.name}
                  </Typography>
                  <Chip
                    label={t('assistantToolUi.studioMovieCount', { count: studio.movieCount })}
                    size="small"
                    sx={{
                      height: 20,
                      bgcolor: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                    }}
                  />
                </Box>
                {studio.topTitles.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {studio.topTitles.map(t => t.title).join(', ')}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {data.networks && data.networks.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: '#e4e4e7' }}>
            {t('assistantToolUi.topTvNetworks')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.networks.map((network) => (
              <Box key={network.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>
                    {network.name}
                  </Typography>
                  <Chip
                    label={t('assistantToolUi.networkSeriesCount', { count: network.seriesCount })}
                    size="small"
                    sx={{
                      height: 20,
                      bgcolor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                    }}
                  />
                </Box>
                {network.topTitles.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {network.topTitles.map(t => t.title).join(', ')}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  )
}

