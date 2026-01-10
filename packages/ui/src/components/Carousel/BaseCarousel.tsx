import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Box, Typography, IconButton, Skeleton } from '@mui/material'
import type { CarouselProps } from './types.js'

const DEFAULT_SKELETON_COUNT = 5

function DefaultSkeleton() {
  return (
    <Box>
      <Skeleton variant="rectangular" width={160} height={240} sx={{ borderRadius: 2 }} />
      <Skeleton width="80%" sx={{ mt: 1 }} />
      <Skeleton width="40%" />
    </Box>
  )
}

// Simple arrow icons as fallback (no MUI icons dependency)
function LeftArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  )
}

function RightArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  )
}

export function BaseCarousel({
  title,
  subtitle,
  loading = false,
  emptyMessage,
  skeletonCount = DEFAULT_SKELETON_COUNT,
  renderSkeleton,
  children,
  hasItems = true,
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
  }, [])

  useEffect(() => {
    updateScrollButtons()
    window.addEventListener('resize', updateScrollButtons)
    return () => window.removeEventListener('resize', updateScrollButtons)
  }, [updateScrollButtons, children])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = direction === 'left' ? -400 : 400
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    setTimeout(updateScrollButtons, 300)
  }

  // Loading state
  if (loading) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Box key={i}>
              {renderSkeleton ? renderSkeleton() : <DefaultSkeleton />}
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  // Empty state
  if (!hasItems) {
    // If no empty message, don't render anything
    if (!emptyMessage) {
      return null
    }

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
      {/* Header */}
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
            <LeftArrow />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            sx={{ opacity: canScrollRight ? 1 : 0.3 }}
          >
            <RightArrow />
          </IconButton>
        </Box>
      </Box>

      {/* Scrollable container */}
      <Box
        ref={scrollRef}
        onScroll={updateScrollButtons}
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          pb: 1,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

/**
 * Wrapper for individual carousel items with proper scroll snap behavior
 */
export function CarouselItem({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ scrollSnapAlign: 'start', flexShrink: 0, position: 'relative' }}>
      {children}
    </Box>
  )
}
