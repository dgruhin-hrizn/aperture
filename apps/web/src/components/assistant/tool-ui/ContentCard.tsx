import { Box, Button, Chip, Paper, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import LocalMoviesOutlinedIcon from '@mui/icons-material/LocalMoviesOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'
import type { ContentItem } from './types'

export function ContentCard({
  item,
  onPlay,
  compactOnMobile = false,
}: {
  item: ContentItem
  onPlay?: (id: string, href: string) => void
  compactOnMobile?: boolean
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
        flexDirection: compactOnMobile ? { xs: 'row', sm: 'column' } : 'column',
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
          aspectRatio: '2 / 3',
          flexShrink: 0,
          bgcolor: 'action.hover',
          textDecoration: 'none',
          ...(compactOnMobile && { width: { xs: 'clamp(80px, 25%, 100px)', sm: '100%' } }),
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
              ...(compactOnMobile && { position: { xs: 'absolute', sm: 'static' }, inset: 0 }),
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
            {compactOnMobile ? (
              <>
                <LocalMoviesOutlinedIcon sx={{ display: { xs: 'block', sm: 'none' } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {item.name}
                </Box>
              </>
            ) : (
              item.name
            )}
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
          p: 1.5,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: compactOnMobile ? { xs: 0.5, sm: 0.75 } : 0.75,
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
            minHeight: compactOnMobile ? { xs: 0, sm: 40 } : 40,
            overflowWrap: 'anywhere',
          }}
        >
          {item.name}
        </Typography>
        {(item.subtitle || item.rating != null) && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: compactOnMobile ? { xs: 'row', sm: 'column' } : 'column',
              gap: compactOnMobile ? { xs: 1, sm: 0.75 } : 0.75,
              alignItems: compactOnMobile ? { xs: 'center', sm: 'stretch' } : 'stretch',
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
        {play?.href && (
          <Box sx={{ mt: 'auto', pt: 0.5 }}>
            <Button
              size="small"
              fullWidth
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              href={play.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={
                onPlay
                  ? (e) => {
                      e.preventDefault()
                      onPlay(item.id, play.href!)
                    }
                  : undefined
              }
              sx={{
                borderRadius: 3,
                ...(compactOnMobile && {
                  width: { xs: 'auto', sm: '100%' },
                  minHeight: { xs: 44, sm: 'initial' },
                  px: { xs: 1.75, sm: 1.25 },
                }),
              }}
            >
              {t('assistantToolUi.play')}
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  )
}
