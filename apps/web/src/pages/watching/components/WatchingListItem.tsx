/**
 * WatchingListItem Component
 * 
 * A beautiful list view card for series in the watching list.
 * Shows rich episode information and upcoming data.
 */

import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  LinearProgress,
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TvIcon from '@mui/icons-material/Tv'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'
import type { WatchingSeries, UpcomingEpisode } from '../hooks/useWatchingData'

interface WatchingListItemProps {
  series: WatchingSeries
  onRemove: (seriesId: string) => Promise<void>
}

function formatAirDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatEpisodeNumber(ep: UpcomingEpisode): string {
  return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`
}

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr)
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getCountdownColor(days: number): string {
  if (days <= 0) return '#10b981' // Today - green
  if (days === 1) return '#f59e0b' // Tomorrow - amber
  if (days <= 3) return '#3b82f6' // Soon - blue
  return '#6b7280' // Later - gray
}

export function WatchingListItem({ series, onRemove }: WatchingListItemProps) {
  const theme = useTheme()
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/series/${series.seriesId}`)
  }

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove(series.seriesId)
  }

  const upcoming = series.upcomingEpisode
  const isAiring = series.status === 'Continuing'
  const daysUntil = upcoming ? getDaysUntil(upcoming.airDate) : null
  const countdownColor = daysUntil !== null ? getCountdownColor(daysUntil) : undefined

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        gap: { xs: 2, md: 3 },
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 30px ${alpha(theme.palette.common.black, 0.15)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
      }}
    >
      {/* Poster */}
      <Box
        sx={{
          position: 'relative',
          flexShrink: 0,
          width: { xs: 80, sm: 100 },
          height: { xs: 120, sm: 150 },
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={getProxiedImageUrl(series.posterUrl)}
          alt={series.title}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = FALLBACK_POSTER_URL
          }}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* Status badge overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 0.5,
            background: isAiring
              ? `linear-gradient(transparent, ${alpha('#10b981', 0.9)})`
              : `linear-gradient(transparent, ${alpha(theme.palette.grey[800], 0.9)})`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 700,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            {isAiring ? (
              <>
                <PlayArrowIcon sx={{ fontSize: 12 }} />
                Airing
              </>
            ) : (
              <>
                <CheckCircleIcon sx={{ fontSize: 12 }} />
                {series.status || 'Ended'}
              </>
            )}
          </Typography>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Title Row */}
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {series.title}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={0.5}>
              {series.year && (
                <Typography variant="body2" color="text.secondary">
                  {series.year}
                </Typography>
              )}
              {series.network && (
                <>
                  <Typography variant="body2" color="text.secondary">•</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {series.network}
                  </Typography>
                </>
              )}
              {series.totalSeasons && (
                <>
                  <Typography variant="body2" color="text.secondary">•</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {series.totalSeasons} Season{series.totalSeasons !== 1 ? 's' : ''}
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          {/* Remove button */}
          <Tooltip title="Remove from watching list">
            <IconButton
              size="small"
              onClick={handleRemoveClick}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'error.main',
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                },
              }}
            >
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Genres */}
        {series.genres && series.genres.length > 0 && (
          <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
            {series.genres.slice(0, 4).map((genre) => (
              <Chip
                key={genre}
                label={genre}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'text.secondary',
                }}
              />
            ))}
          </Box>
        )}

        {/* Overview */}
        {series.overview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {series.overview}
          </Typography>
        )}

        {/* Spacer */}
        <Box flex={1} />
      </Box>

      {/* Upcoming Episode Section */}
      <Box
        sx={{
          flexShrink: 0,
          width: { xs: '100%', md: 280 },
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'column',
          gap: 1,
          p: 2,
          borderRadius: 2,
          bgcolor: upcoming
            ? alpha(countdownColor || theme.palette.primary.main, 0.08)
            : alpha(theme.palette.grey[500], 0.08),
          border: `1px solid ${alpha(upcoming ? countdownColor || theme.palette.primary.main : theme.palette.grey[500], 0.2)}`,
        }}
      >
        {upcoming ? (
          <>
            {/* Countdown badge */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: alpha(countdownColor!, 0.15),
                }}
              >
                <ScheduleIcon sx={{ fontSize: 16, color: countdownColor }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: countdownColor, textTransform: 'uppercase' }}
                >
                  {formatAirDate(upcoming.airDate)}
                </Typography>
              </Box>
              <Chip
                label={upcoming.source.toUpperCase()}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.text.secondary, 0.1),
                }}
              />
            </Box>

            {/* Episode info */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                {formatEpisodeNumber(upcoming)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {upcoming.title}
              </Typography>
            </Box>

            {/* Progress bar for countdown */}
            {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, 100 - (daysUntil / 7) * 100)}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: alpha(countdownColor!, 0.15),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: countdownColor,
                      borderRadius: 2,
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {daysUntil === 0 ? 'Airs today!' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} to go`}
                </Typography>
              </Box>
            )}
          </>
        ) : isAiring ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              py: 2,
            }}
          >
            <AccessTimeIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              No episode data available
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Check back soon
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              py: 2,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Series Complete
            </Typography>
            {series.totalEpisodes && (
              <Typography variant="caption" color="text.disabled">
                {series.totalEpisodes} episodes
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
