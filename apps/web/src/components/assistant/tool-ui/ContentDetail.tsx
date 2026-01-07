/**
 * Content detail view for Tool UI
 * Rich display of a single movie or series
 */
import { Box, Typography, Paper, Chip, Button, Divider } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import InfoIcon from '@mui/icons-material/Info'
import StarIcon from '@mui/icons-material/Star'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useNavigate } from 'react-router-dom'
import type { ContentDetailData } from './types'

interface ContentDetailProps {
  data: ContentDetailData
}

export function ContentDetail({ data }: ContentDetailProps) {
  const navigate = useNavigate()

  const detailsAction = data.actions.find(a => a.id === 'details')
  const playAction = data.actions.find(a => a.id === 'play')

  const handleDetails = () => {
    if (detailsAction?.href) {
      navigate(detailsAction.href)
    }
  }

  const handlePlay = () => {
    if (playAction?.href) {
      window.open(playAction.href, '_blank')
    }
  }

  return (
    <Paper sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, my: 2 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Poster */}
        <Box
          sx={{
            width: 120,
            height: 180,
            flexShrink: 0,
            borderRadius: 1.5,
            overflow: 'hidden',
            bgcolor: '#2a2a2a',
          }}
        >
          {data.image ? (
            <Box
              component="img"
              src={data.image}
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
                color: '#666',
                fontSize: 12,
              }}
            >
              No Image
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title and type */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
              {data.name}
            </Typography>
            <Chip
              label={data.type === 'movie' ? 'Movie' : 'Series'}
              size="small"
              sx={{
                height: 20,
                bgcolor: data.type === 'movie' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: data.type === 'movie' ? '#818cf8' : '#10b981',
              }}
            />
          </Box>

          {/* Year / Year Range */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {data.yearRange || data.year}
            {data.runtime && ` · ${data.runtime}`}
            {data.contentRating && ` · ${data.contentRating}`}
          </Typography>

          {/* Tagline */}
          {data.tagline && (
            <Typography variant="body2" fontStyle="italic" color="text.secondary" sx={{ mb: 1 }}>
              "{data.tagline}"
            </Typography>
          )}

          {/* Ratings */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
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
                label={data.playCount && data.playCount > 1 ? `Watched ${data.playCount}x` : 'Watched'}
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
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {data.genres.map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: '#2a2a2a',
                    color: '#a1a1aa',
                  }}
                />
              ))}
            </Box>
          )}

          {/* Director / Network */}
          {(data.director || data.network) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {data.director && `Director: ${data.director}`}
              {data.network && `Network: ${data.network}`}
              {data.status && ` · ${data.status}`}
            </Typography>
          )}

          {/* Series info */}
          {data.type === 'series' && (data.seasonCount || data.episodeCount) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {data.seasonCount} seasons · {data.episodeCount} episodes
              {data.episodesWatched !== undefined && data.episodesWatched > 0 && (
                ` · ${data.episodesWatched} watched`
              )}
            </Typography>
          )}

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<InfoIcon />}
              onClick={handleDetails}
              sx={{
                borderColor: '#3a3a3a',
                color: '#a1a1aa',
                '&:hover': {
                  borderColor: '#6366f1',
                  bgcolor: 'rgba(99, 102, 241, 0.1)',
                },
              }}
            >
              View Details
            </Button>
            {playAction && (
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handlePlay}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  },
                }}
              >
                Play on Emby
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Overview */}
      {data.overview && (
        <>
          <Divider sx={{ my: 2, borderColor: '#2a2a2a' }} />
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {data.overview}
          </Typography>
        </>
      )}

      {/* Cast */}
      {data.cast && data.cast.length > 0 && (
        <>
          <Divider sx={{ my: 2, borderColor: '#2a2a2a' }} />
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Cast
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.cast.join(', ')}
          </Typography>
        </>
      )}
    </Paper>
  )
}

