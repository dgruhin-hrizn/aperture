import { useTranslation } from 'react-i18next'
import { Box, Typography, IconButton, useTheme } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { ContentCard } from './ContentCard'
import { useCarouselScroll } from './useCarouselScroll'
import type { ContentCarouselData } from './types'

export function ContentCarousel({
  data,
  onPlay,
}: {
  data: ContentCarouselData
  onPlay?: (id: string, href: string) => void
}) {
  const { t } = useTranslation(),
    rtl = useTheme().direction === 'rtl'
  const { ref, edges, scroll } = useCarouselScroll(data.items.length, rtl)
  const title = data.titleKey
    ? t(`assistantToolUi.${data.titleKey}`, { ...data.titleParams, defaultValue: data.title })
    : data.title
  const description = data.descriptionKey
    ? t(`assistantToolUi.${data.descriptionKey}`, {
        ...data.descriptionParams,
        defaultValue: data.description,
      })
    : data.description
  const single = data.items.length === 1
  const controls = !single && (edges.previous || edges.next)
  if (!data.items.length && !title && !description) return null
  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {(title || description || controls) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {title && (
              <Typography variant="subtitle1" fontWeight={600}>
                {title}
              </Typography>
            )}
            {description && (
              <Typography component="div" variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          {controls && (
            <Box sx={{ display: 'flex', flexShrink: 0 }}>
              <IconButton
                aria-label={t(
                  rtl ? 'assistantToolUi.scrollCarouselRight' : 'assistantToolUi.scrollCarouselLeft'
                )}
                disabled={!edges.previous}
                onClick={() => scroll(false)}
                sx={{ width: 44, height: 44 }}
              >
                {rtl ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
              <IconButton
                aria-label={t(
                  rtl ? 'assistantToolUi.scrollCarouselLeft' : 'assistantToolUi.scrollCarouselRight'
                )}
                disabled={!edges.next}
                onClick={() => scroll(true)}
                sx={{ width: 44, height: 44 }}
              >
                {rtl ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Box>
          )}
        </Box>
      )}
      {!!data.items.length && (
        <Box
          ref={ref}
          sx={{
            display: 'flex',
            gap: '12px',
            justifyContent: single ? 'center' : 'flex-start',
            overflowX: 'auto',
            overflowY: 'hidden',
            py: 0.5,
            scrollSnapType: 'x mandatory',
            overscrollBehaviorX: 'contain',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {data.items.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                minWidth: 0,
                flex: { xs: single ? '0 0 100%' : '0 0 calc((100% - 12px) / 2)', sm: '0 0 170px' },
                maxWidth: { xs: single ? '100%' : 220, sm: 170 },
                scrollSnapAlign: 'start',
              }}
            >
              <ContentCard item={item} onPlay={onPlay} compactOnMobile={single} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
