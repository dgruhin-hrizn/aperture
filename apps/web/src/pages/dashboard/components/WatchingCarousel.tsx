import { useCallback } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useNavigate } from 'react-router-dom'
import { MoviePoster, BaseCarousel, CarouselItem } from '@aperture/ui'
import { useUserRatings } from '../../../hooks/useUserRatings'
import { useWatching } from '../../../hooks/useWatching'

interface UpcomingEpisode {
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate: string
}

interface WatchingItem {
  id: string
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  overview: string | null
  communityRating: number | null
  status: string | null
  upcomingEpisode: UpcomingEpisode | null
}

interface WatchingCarouselProps {
  title: string
  subtitle?: string
  items: WatchingItem[]
  loading?: boolean
  emptyMessage?: string
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
  })
}

function formatEpisodeNumber(ep: UpcomingEpisode): string {
  return `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`
}

export function WatchingCarousel({
  title,
  subtitle,
  items,
  loading,
  emptyMessage = 'No shows to display',
}: WatchingCarouselProps) {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { toggleWatching } = useWatching()

  const handleRate = useCallback(
    async (id: string, rating: number | null) => {
      try {
        await setRating('series', id, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating]
  )

  const handleItemClick = (item: WatchingItem) => {
    navigate(`/series/${item.seriesId}`)
  }

  // Don't render if no items (carousel handles empty state internally but we want to hide completely)
  if (!loading && items.length === 0) {
    return null
  }

  return (
    <BaseCarousel
      title={title}
      subtitle={subtitle}
      loading={loading}
      hasItems={items.length > 0}
    >
      {items.map((item) => (
        <CarouselItem key={item.id}>
          <MoviePoster
            title={item.title}
            year={item.year}
            posterUrl={item.posterUrl}
            rating={item.communityRating}
            genres={item.genres}
            overview={item.overview}
            userRating={getRating('series', item.seriesId)}
            onRate={(rating) => handleRate(item.seriesId, rating)}
            isWatching={true}
            onWatchingToggle={() => toggleWatching(item.seriesId)}
            size="medium"
            onClick={() => handleItemClick(item)}
          >
            {/* Status badge */}
            {item.status === 'Continuing' && (
              <Chip
                label="Airing"
                size="small"
                color="success"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  height: 20,
                  zIndex: 3,
                }}
              />
            )}
          </MoviePoster>

          {/* Upcoming episode info */}
          {item.upcomingEpisode && (
            <Box
              sx={{
                mt: 1,
                p: 0.75,
                borderRadius: 1,
                backgroundColor: 'background.paper',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {formatAirDate(item.upcomingEpisode.airDate)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {formatEpisodeNumber(item.upcomingEpisode)}
                </Typography>
              </Box>
            </Box>
          )}
        </CarouselItem>
      ))}
    </BaseCarousel>
  )
}
