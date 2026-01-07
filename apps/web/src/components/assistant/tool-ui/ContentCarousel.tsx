/**
 * Content carousel for Tool UI
 * Horizontal scrollable list of content cards
 */
import { useRef } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { ContentCard } from './ContentCard'
import type { ContentCarouselData } from './types'

interface ContentCarouselProps {
  data: ContentCarouselData
  onPlay?: (id: string, href: string) => void
}

export function ContentCarousel({ data, onPlay }: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  if (data.items.length === 0) {
    return (
      <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {data.description || 'No results found.'}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ my: 2, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      {(data.title || data.description) && (
        <Box sx={{ mb: 1.5 }}>
          {data.title && (
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#e4e4e7' }}>
              {data.title}
            </Typography>
          )}
          {data.description && (
            <Typography variant="caption" color="text.secondary">
              {data.description}
            </Typography>
          )}
        </Box>
      )}

      {/* Carousel container */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {/* Scroll buttons */}
        {data.items.length > 2 && (
          <>
            <IconButton
              onClick={() => scroll('left')}
              sx={{
                position: 'absolute',
                left: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  bgcolor: 'rgba(99, 102, 241, 0.8)',
                },
              }}
              size="small"
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              onClick={() => scroll('right')}
              sx={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  bgcolor: 'rgba(99, 102, 241, 0.8)',
                },
              }}
              size="small"
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}

        {/* Scrollable content */}
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            overflowY: 'hidden',
            px: 1,
            py: 0.5,
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            // Hide scrollbar but keep functionality
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            '&::-webkit-scrollbar': {
              display: 'none', // Chrome/Safari
            },
          }}
        >
          {data.items.map((item) => (
            <Box key={item.id} sx={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
              <ContentCard item={item} onPlay={onPlay} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

