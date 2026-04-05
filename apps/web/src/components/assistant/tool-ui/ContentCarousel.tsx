/**
 * Content carousel for Tool UI
 * Horizontal scrollable list of content cards
 */
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, IconButton, useTheme } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { ContentCard } from './ContentCard'
import type { ContentCarouselData } from './types'

interface ContentCarouselProps {
  data: ContentCarouselData
  onPlay?: (id: string, href: string) => void
}

function useCarouselHeaderText(data: ContentCarouselData) {
  const { t } = useTranslation()
  const title = data.titleKey
    ? t(`assistantToolUi.${data.titleKey}`, {
        ...(data.titleParams ?? {}),
        defaultValue: data.title,
      })
    : data.title
  const description = data.descriptionKey
    ? t(`assistantToolUi.${data.descriptionKey}`, {
        ...(data.descriptionParams ?? {}),
        defaultValue: data.description,
      })
    : data.description
  const resolvedTitle = typeof title === 'string' && title.length > 0 ? title : undefined
  const resolvedDescription = typeof description === 'string' && description.length > 0 ? description : undefined
  return { resolvedTitle, resolvedDescription }
}

export function ContentCarousel({ data, onPlay }: ContentCarouselProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const rtl = theme.direction === 'rtl'
  const scrollRef = useRef<HTMLDivElement>(null)
  const { resolvedTitle, resolvedDescription } = useCarouselHeaderText(data)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      let delta = direction === 'left' ? -scrollAmount : scrollAmount
      if (rtl) delta = -delta
      scrollRef.current.scrollBy({
        left: delta,
        behavior: 'smooth',
      })
    }
  }

  const hasHeader = Boolean(resolvedTitle || resolvedDescription)
  const isEmpty = data.items.length === 0

  if (isEmpty) {
    if (!hasHeader) return null
    return (
      <Box sx={{ my: 2, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
        <Box sx={{ mb: 1.5 }}>
          {resolvedTitle && (
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#e4e4e7' }}>
              {resolvedTitle}
            </Typography>
          )}
          {resolvedDescription && (
            <Typography variant="caption" color="text.secondary">
              {resolvedDescription}
            </Typography>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ my: 2, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      {hasHeader && (
        <Box sx={{ mb: 1.5 }}>
          {resolvedTitle && (
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#e4e4e7' }}>
              {resolvedTitle}
            </Typography>
          )}
          {resolvedDescription && (
            <Typography variant="caption" color="text.secondary">
              {resolvedDescription}
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
              aria-label={t('assistantToolUi.scrollCarouselLeft')}
              sx={{
                position: 'absolute',
                insetInlineStart: 4,
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
              aria-label={t('assistantToolUi.scrollCarouselRight')}
              sx={{
                position: 'absolute',
                insetInlineEnd: 4,
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
