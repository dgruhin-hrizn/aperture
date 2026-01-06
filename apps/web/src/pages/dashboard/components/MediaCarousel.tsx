import { Box, Typography, IconButton, Skeleton } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../../../hooks/useUserRatings'

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

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, { bg: string; border: string }> = {
    1: { bg: 'linear-gradient(135deg, #ffd700 0%, #ffec8b 100%)', border: '#daa520' },
    2: { bg: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)', border: '#a8a8a8' },
    3: { bg: 'linear-gradient(135deg, #cd7f32 0%, #daa06d 100%)', border: '#8b4513' },
  }
  const style = colors[rank] || { bg: 'rgba(0,0,0,0.7)', border: 'transparent' }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: 8,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: style.bg,
        border: `2px solid ${style.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
        boxShadow: 2,
      }}
    >
      <Typography
        variant="caption"
        fontWeight={800}
        sx={{ color: rank <= 3 ? '#000' : '#fff', fontSize: '0.75rem' }}
      >
        {rank}
      </Typography>
    </Box>
  )
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()

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

  const updateScrollButtons = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    updateScrollButtons()
    window.addEventListener('resize', updateScrollButtons)
    return () => window.removeEventListener('resize', updateScrollButtons)
  }, [items])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = direction === 'left' ? -400 : 400
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    setTimeout(updateScrollButtons, 300)
  }

  const handleItemClick = (item: MediaItem) => {
    navigate(`/${item.type === 'movie' ? 'movies' : 'series'}/${item.id}`)
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i}>
              <Skeleton variant="rectangular" width={160} height={240} sx={{ borderRadius: 2 }} />
              <Skeleton width="80%" sx={{ mt: 1 }} />
              <Skeleton width="40%" />
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  if (items.length === 0) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {title}
        </Typography>
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            backgroundColor: 'background.paper',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Typography color="text.secondary">{emptyMessage}</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            sx={{ opacity: canScrollLeft ? 1 : 0.3 }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            sx={{ opacity: canScrollRight ? 1 : 0.3 }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={scrollRef}
        onScroll={updateScrollButtons}
        sx={{
          display: 'flex',
          flexDirection: rows === 2 ? 'column' : 'row',
          gap: 2,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          pb: 1,
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          '&::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
        }}
      >
        {rows === 2 ? (
          // Two-row layout: split items into pairs for vertical stacking
          <Box sx={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: Math.ceil(items.length / 2) }).map((_, colIndex) => {
              const topItem = items[colIndex * 2]
              const bottomItem = items[colIndex * 2 + 1]
              return (
                <Box
                  key={colIndex}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    scrollSnapAlign: 'start',
                    flexShrink: 0,
                  }}
                >
                  {topItem && (
                    <Box sx={{ position: 'relative' }}>
                      <MoviePoster
                        title={topItem.title}
                        year={topItem.year}
                        posterUrl={topItem.posterUrl}
                        genres={topItem.genres}
                        score={showScore ? (topItem.matchScore ? topItem.matchScore / 100 : null) : undefined}
                        showScore={showScore && topItem.matchScore != null}
                        userRating={getRating(topItem.type, topItem.id)}
                        onRate={(rating) => handleRate(topItem.type, topItem.id, rating)}
                        onClick={() => handleItemClick(topItem)}
                        size="medium"
                      >
                        {showRank && topItem.rank && <RankBadge rank={topItem.rank} />}
                      </MoviePoster>
                    </Box>
                  )}
                  {bottomItem && (
                    <Box sx={{ position: 'relative' }}>
                      <MoviePoster
                        title={bottomItem.title}
                        year={bottomItem.year}
                        posterUrl={bottomItem.posterUrl}
                        genres={bottomItem.genres}
                        score={showScore ? (bottomItem.matchScore ? bottomItem.matchScore / 100 : null) : undefined}
                        showScore={showScore && bottomItem.matchScore != null}
                        userRating={getRating(bottomItem.type, bottomItem.id)}
                        onRate={(rating) => handleRate(bottomItem.type, bottomItem.id, rating)}
                        onClick={() => handleItemClick(bottomItem)}
                        size="medium"
                      >
                        {showRank && bottomItem.rank && <RankBadge rank={bottomItem.rank} />}
                      </MoviePoster>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        ) : (
          // Single-row layout
          items.map((item) => (
            <Box
              key={`${item.type}-${item.id}`}
              sx={{ scrollSnapAlign: 'start', flexShrink: 0, position: 'relative' }}
            >
              <MoviePoster
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
                genres={item.genres}
                score={showScore ? (item.matchScore ? item.matchScore / 100 : null) : undefined}
                showScore={showScore && item.matchScore != null}
                userRating={getRating(item.type, item.id)}
                onRate={(rating) => handleRate(item.type, item.id, rating)}
                onClick={() => handleItemClick(item)}
                size="medium"
              >
                {showRank && item.rank && <RankBadge rank={item.rank} />}
              </MoviePoster>
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}

