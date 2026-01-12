/**
 * WatchingCard Component
 * 
 * Uses standard MoviePoster with watching-specific info underneath.
 */

import { useNavigate } from 'react-router-dom'
import { Box, Typography, Chip } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import TvIcon from '@mui/icons-material/Tv'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '@/hooks/useUserRatings'
import type { WatchingSeries, UpcomingEpisode } from '../hooks/useWatchingData'

interface WatchingCardProps {
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
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatEpisodeNumber(ep: UpcomingEpisode): string {
  return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`
}

export function WatchingCard({ series, onRemove }: WatchingCardProps) {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()

  const handleClick = () => {
    navigate(`/series/${series.seriesId}`)
  }

  const handleRate = async (rating: number | null) => {
    try {
      await setRating('series', series.seriesId, rating)
    } catch (err) {
      console.error('Failed to rate series:', err)
    }
  }

  const upcoming = series.upcomingEpisode
  const isAiring = series.status === 'Continuing'

  return (
    <Box sx={{ width: '100%' }}>
      {/* Standard MoviePoster */}
      <MoviePoster
        title={series.title}
        year={series.year}
        posterUrl={series.posterUrl}
        rating={series.communityRating}
        genres={series.genres}
        overview={series.overview}
        userRating={getRating('series', series.seriesId)}
        onRate={handleRate}
        isWatching={true}
        onWatchingToggle={() => onRemove(series.seriesId)}
        responsive
        onClick={handleClick}
      >
        {/* Status badge */}
        <Chip
          label={isAiring ? 'Airing' : series.status || 'Ended'}
          size="small"
          color={isAiring ? 'success' : 'default'}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontWeight: 600,
            fontSize: '0.7rem',
            zIndex: 3,
          }}
        />
      </MoviePoster>

      {/* Upcoming episode info - below poster, fixed height */}
      <Box
        sx={{
          mt: 1,
          p: 1,
          borderRadius: 1,
          backgroundColor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          height: 52,
          overflow: 'hidden',
        }}
      >
        {upcoming ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="caption" color="primary.main" fontWeight={600}>
                Next: {formatAirDate(upcoming.airDate)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {formatEpisodeNumber(upcoming)} - {upcoming.title}
            </Typography>
          </>
        ) : isAiring ? (
          <Typography variant="caption" color="text.secondary">
            No upcoming episode data
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TvIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Series ended
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
