import { Box, Chip, Paper, Typography } from '@mui/material'
import LocalMoviesOutlinedIcon from '@mui/icons-material/LocalMoviesOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'
import { ContentCardActions } from './ContentCardActions'
import type { ContentItem } from './types'

export function ContentCard({
  item,
  onPlay,
  featured = false,
}: {
  item: ContentItem
  onPlay?: (id: string, href: string) => void
  featured?: boolean
}) {
  const { t } = useTranslation()
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [item.image])
  const details = item.actions?.find((a) => a.id === 'details'),
    play = item.actions?.find((a) => a.id === 'play')
  return (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: featured ? 'row' : 'column',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        component="a"
        href={details?.href}
        aria-label={item.name}
        sx={{
          display: 'block',
          position: 'relative',
          aspectRatio: featured ? '2 / 3' : { xs: '4 / 5', sm: '2 / 3' },
          flexShrink: 0,
          bgcolor: 'action.hover',
          textDecoration: 'none',
          ...(featured && { width: { xs: 'clamp(80px, 25%, 105px)', sm: 116 } }),
        }}
      >
        {item.image ? (
          <Box
            component="img"
            src={imageFailed ? FALLBACK_POSTER_URL : getProxiedImageUrl(item.image)}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            sx={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              position: 'absolute',
              inset: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'text.secondary',
              p: 2,
            }}
          >
            <LocalMoviesOutlinedIcon aria-hidden />
          </Box>
        )}
        {item.rank && (
          <Chip
            size="small"
            label={`#${item.rank}`}
            sx={{
              position: 'absolute',
              top: 8,
              insetInlineStart: 8,
              bgcolor: 'background.paper',
              fontWeight: 700,
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          p: featured ? { xs: 1.25, sm: 1.5 } : 1.25,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={t(`encore.availability.${item.availability ?? 'library'}`)}
          sx={{ alignSelf: 'flex-start', maxWidth: '100%', height: 20, fontSize: 10 }}
        />
        <Typography
          component="a"
          href={details?.href}
          variant="body2"
          fontWeight={650}
          sx={{
            color: 'text.primary',
            textDecoration: 'none',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '20px',
            minHeight: featured ? 0 : { xs: 20, sm: 40 },
            fontSize: featured ? '1rem' : undefined,
            overflowWrap: 'anywhere',
          }}
        >
          {item.name}
        </Typography>
        {(item.subtitle || item.rating != null) && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: featured ? 'row' : 'column',
              gap: featured ? 1 : 0.5,
              alignItems: featured ? 'center' : 'stretch',
            }}
          >
            {item.subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
                sx={{ minWidth: 0 }}
              >
                {item.subtitle}
              </Typography>
            )}
            {item.rating != null && (
              <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center', flexShrink: 0 }}>
                <StarRoundedIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                <Typography variant="caption">{Number(item.rating).toFixed(1)}</Typography>
              </Box>
            )}
          </Box>
        )}
        {item.overview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: featured ? '0.8125rem' : '0.75rem',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {item.overview}
          </Typography>
        )}
        <ContentCardActions
          item={item}
          detailsHref={details?.href}
          playHref={play?.href}
          onPlay={onPlay}
          featured={featured}
        />
      </Box>
    </Paper>
  )
}
