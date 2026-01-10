import { useCallback } from 'react'
import { Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MoviePoster, RankBadge, BaseCarousel, CarouselItem } from '@aperture/ui'
import { useUserRatings } from '../../../hooks/useUserRatings'
import { useWatching } from '../../../hooks/useWatching'

interface MediaItem {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  matchScore?: number | null
  rank?: number
}

interface MediaCarouselProps {
  title: string
  subtitle?: string
  items: MediaItem[]
  loading?: boolean
  showScore?: boolean
  showRank?: boolean
  emptyMessage?: string
  rows?: 1 | 2
}

export function MediaCarousel({
  title,
  subtitle,
  items,
  loading,
  showScore = false,
  showRank = false,
  emptyMessage = 'No items to display',
  rows = 1,
}: MediaCarouselProps) {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()

  const handleRate = useCallback(
    async (type: 'movie' | 'series', id: string, rating: number | null) => {
      try {
        await setRating(type, id, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating]
  )

  const handleItemClick = (item: MediaItem) => {
    navigate(`/${item.type === 'movie' ? 'movies' : 'series'}/${item.id}`)
  }

  const renderPoster = (item: MediaItem) => (
    <MoviePoster
      title={item.title}
      year={item.year}
      posterUrl={item.posterUrl}
      genres={item.genres}
      score={showScore ? (item.matchScore ? item.matchScore / 100 : null) : undefined}
      showScore={showScore && item.matchScore != null}
      userRating={getRating(item.type, item.id)}
      onRate={(rating) => handleRate(item.type, item.id, rating)}
      isWatching={item.type === 'series' ? isWatching(item.id) : undefined}
      onWatchingToggle={item.type === 'series' ? () => toggleWatching(item.id) : undefined}
      hideWatchingToggle={item.type !== 'series'}
      onClick={() => handleItemClick(item)}
      size="medium"
    >
      {showRank && item.rank && <RankBadge rank={item.rank} />}
    </MoviePoster>
  )

  if (rows === 2) {
    // Two-row layout: split items into pairs for vertical stacking
    return (
      <BaseCarousel
        title={title}
        subtitle={subtitle}
        loading={loading}
        emptyMessage={emptyMessage}
        hasItems={items.length > 0}
      >
        {Array.from({ length: Math.ceil(items.length / 2) }).map((_, colIndex) => {
          const topItem = items[colIndex * 2]
          const bottomItem = items[colIndex * 2 + 1]
          return (
            <CarouselItem key={colIndex}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topItem && <Box sx={{ position: 'relative' }}>{renderPoster(topItem)}</Box>}
                {bottomItem && <Box sx={{ position: 'relative' }}>{renderPoster(bottomItem)}</Box>}
              </Box>
            </CarouselItem>
          )
        })}
      </BaseCarousel>
    )
  }

  // Single-row layout
  return (
    <BaseCarousel
      title={title}
      subtitle={subtitle}
      loading={loading}
      emptyMessage={emptyMessage}
      hasItems={items.length > 0}
    >
      {items.map((item) => (
        <CarouselItem key={`${item.type}-${item.id}`}>
          {renderPoster(item)}
        </CarouselItem>
      ))}
    </BaseCarousel>
  )
}
