/**
 * Content detail view for Tool UI
 * Rich display of a single movie or series
 */
import { useId, useState } from 'react'
import { Box, Typography, Chip, Button, Divider, Stack } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import StarIcon from '@mui/icons-material/Star'
import FavoriteIcon from '@mui/icons-material/Favorite'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useTranslation } from 'react-i18next'
import { getProxiedImageUrl } from '@aperture/ui'
import { ToolCard } from '../ToolCard'
import { ContentCardActions } from './ContentCardActions'
import type { ContentDetailData } from './types'

interface ContentDetailProps {
  data: ContentDetailData
}

export function ContentDetail({ data }: ContentDetailProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const detailsHref = data.actions.find((action) => action.id === 'details')?.href
  const playHref = data.actions.find((action) => action.id === 'play')?.href
  const hasExtras = Boolean(
    data.cast?.length || data.tagline || data.director || data.network || data.status
  )
  const hasMore = hasExtras || (data.overview?.length ?? 0) > 120

  return (
    <ToolCard variant="outlined">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: { xs: 1.25, sm: 2 },
        }}
      >
        {/* Poster */}
        <Box
          sx={{
            width: { xs: 78, sm: 120 },
            aspectRatio: '2 / 3',
            flexShrink: 0,
            borderRadius: 1.5,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {data.image ? (
            <Box
              component="img"
              src={getProxiedImageUrl(data.image)}
              alt={data.name}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {t('assistantToolUi.noImage')}
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {/* Title and type */}
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1, mb: 0.5 }}
          >
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.25 }}>
              {data.name}
            </Typography>
            <Chip
              label={
                data.type === 'movie' ? t('assistantToolUi.movie') : t('assistantToolUi.series')
              }
              size="small"
              sx={{
                height: 20,
                bgcolor:
                  data.type === 'movie' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: data.type === 'movie' ? '#818cf8' : '#10b981',
              }}
            />
          </Box>

          {/* Year / Year Range */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {[data.yearRange || data.year, data.runtime, data.contentRating]
              .filter(Boolean)
              .join(' · ')}
          </Typography>

          {/* Ratings */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
            {data.communityRating && (
              <Chip
                icon={<StarIcon sx={{ fontSize: 14 }} />}
                label={Number(data.communityRating).toFixed(1)}
                size="small"
                sx={{
                  height: 24,
                  bgcolor: 'rgba(255, 193, 7, 0.15)',
                  color: '#ffc107',
                  '& .MuiChip-icon': { color: '#ffc107' },
                }}
              />
            )}
            {data.userRating && (
              <Chip
                icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                label={`${data.userRating}/10`}
                size="small"
                sx={{
                  height: 24,
                  bgcolor: 'rgba(236, 72, 153, 0.15)',
                  color: '#ec4899',
                  '& .MuiChip-icon': { color: '#ec4899' },
                }}
              />
            )}
            {data.isWatched && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label={
                  data.playCount && data.playCount > 1
                    ? t('assistantToolUi.watchedCount', { count: data.playCount })
                    : t('assistantToolUi.watched')
                }
                size="small"
                sx={{
                  height: 24,
                  bgcolor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  '& .MuiChip-icon': { color: '#10b981' },
                }}
              />
            )}
          </Box>

          {/* Genres */}
          {data.genres && data.genres.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
              {data.genres.map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                  }}
                />
              ))}
            </Box>
          )}

          {/* Series info */}
          {data.type === 'series' && (data.seasonCount || data.episodeCount) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('assistantToolUi.seriesCounts', {
                seasons: data.seasonCount ?? 0,
                episodes: data.episodeCount ?? 0,
              })}
              {data.episodesWatched !== undefined &&
                data.episodesWatched > 0 &&
                t('assistantToolUi.episodesWatchedSuffix', { count: data.episodesWatched })}
            </Typography>
          )}
        </Box>
      </Box>
      <Stack gap={0.75} sx={{ mt: 1 }}>
        <Box id={detailsId}>
          {data.overview && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                lineHeight: 1.55,
                ...(!expanded &&
                  hasMore && {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }),
              }}
            >
              {data.overview}
            </Typography>
          )}
          <Box hidden={!expanded || !hasExtras}>
            <Divider sx={{ my: 0.75 }} />
            <Stack gap={0.5}>
              {data.tagline && (
                <Typography variant="body2" fontStyle="italic" color="text.secondary">
                  {data.tagline}
                </Typography>
              )}
              {/* Director / Network */}
              {(data.director || data.network || data.status) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {[
                    data.director && t('assistantToolUi.directorPrefix', { name: data.director }),
                    data.network && t('assistantToolUi.networkPrefix', { name: data.network }),
                    data.status,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              )}

              {data.cast && data.cast.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">
                    {t('assistantToolUi.castHeading')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.cast.join(', ')}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>
        <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={0.75}>
          <ContentCardActions
            item={{ id: data.contentId, type: data.type, name: data.name }}
            detailsHref={detailsHref}
            playHref={playHref}
            featured
          />
          {hasMore && (
            <Button
              size="small"
              aria-controls={detailsId}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              endIcon={<ExpandMoreRoundedIcon sx={{ rotate: expanded ? '180deg' : '0deg' }} />}
              sx={{ minHeight: 44, maxWidth: '100%' }}
            >
              {t(expanded ? 'encore.hideCardDetails' : 'encore.showCardDetails')}
            </Button>
          )}
        </Stack>
      </Stack>
    </ToolCard>
  )
}
