import React, { useState } from 'react'
import { Box, Typography, Paper, Chip, Skeleton, Tooltip, IconButton } from '@mui/material'
import Star from '@mui/icons-material/Star'
import AddToQueue from '@mui/icons-material/AddToQueue'
import PlaylistAddCheck from '@mui/icons-material/PlaylistAddCheck'
import { HeartRating } from './HeartRating.js'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from './imageUtils.js'

const StarIcon = Star as unknown as React.ComponentType<{ fontSize?: string }>
const AddToQueueIcon = AddToQueue as unknown as React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>
const PlaylistAddCheckIcon = PlaylistAddCheck as unknown as React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>

export interface MoviePosterProps {
  title: string
  year?: number | null
  posterUrl?: string | null
  rating?: number | null
  /** User's personal rating (1-10) */
  userRating?: number | null
  /** Callback when user rates the content */
  onRate?: (rating: number | null) => void
  /** Recommendation match score (0-1) - only shown when showScore is true */
  score?: number | null
  genres?: string[]
  overview?: string | null
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
  /** Show the personalized match score badge (for recommendations only) */
  showScore?: boolean
  /** Hide the community rating badge */
  hideRating?: boolean
  /** Hide the heart rating button (e.g., on detail pages where it's shown elsewhere) */
  hideHeartRating?: boolean
  /** Whether this series is in user's watching list */
  isWatching?: boolean
  /** Callback when user toggles watching status */
  onWatchingToggle?: () => void
  /** Hide the watching toggle button */
  hideWatchingToggle?: boolean
  loading?: boolean
  /** Make poster fill container width with 2:3 aspect ratio (for responsive grids) */
  responsive?: boolean
  children?: React.ReactNode
}

const sizeConfig = {
  small: { width: 120, height: 180 },
  medium: { width: 160, height: 240 },
  large: { width: 200, height: 300 },
}

export function MoviePoster({
  title,
  year,
  posterUrl,
  rating,
  userRating,
  onRate,
  score,
  genres,
  overview,
  onClick,
  size = 'medium',
  showScore = false,
  hideRating = false,
  hideHeartRating = false,
  isWatching = false,
  onWatchingToggle,
  hideWatchingToggle = false,
  loading = false,
  responsive = false,
  children,
}: MoviePosterProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const dimensions = sizeConfig[size]

  // Proxy the image URL through our API to avoid mixed content issues
  const proxiedPosterUrl = getProxiedImageUrl(posterUrl)

  if (loading) {
    return (
      <Box sx={{ width: responsive ? '100%' : dimensions.width }}>
        <Skeleton
          variant="rectangular"
          sx={{ 
            width: '100%',
            aspectRatio: '2/3',
            height: responsive ? 'auto' : dimensions.height,
            borderRadius: 1,
          }}
        />
        <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
        <Skeleton variant="text" width="40%" />
      </Box>
    )
  }

  // Calculate max lines for overview based on size
  const overviewLines = size === 'small' ? 3 : size === 'medium' ? 5 : 7

  return (
    <Box
      sx={{
        width: responsive ? '100%' : dimensions.width,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <Paper
        elevation={isHovered ? 8 : 3}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2/3',
          height: responsive ? 'auto' : dimensions.height,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: 'grey.900',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {posterUrl && !imageError ? (
          <Box
            component="img"
            src={proxiedPosterUrl}
            alt={title}
            onError={() => setImageError(true)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            component="img"
            src={FALLBACK_POSTER_URL}
            alt={title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Community rating badge - top right */}
        {!hideRating && rating != null && (
          <Chip
            icon={<StarIcon fontSize="small" />}
            label={Number(rating).toFixed(1)}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: 'warning.main',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              '& .MuiChip-icon': {
                color: 'warning.main',
              },
              zIndex: 2,
            }}
          />
        )}

        {/* Watching toggle button - bottom left */}
        {!hideWatchingToggle && onWatchingToggle && (
          <Tooltip title={isWatching ? 'Remove from watching list' : 'Add to watching list'} arrow>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                onWatchingToggle()
              }}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                zIndex: 4,
                backgroundColor: isWatching ? 'rgba(99, 102, 241, 0.9)' : 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: isWatching ? 'rgba(99, 102, 241, 1)' : 'rgba(0, 0, 0, 0.8)',
                  transform: 'scale(1.1)',
                },
              }}
            >
              {isWatching ? <PlaylistAddCheckIcon fontSize="small" /> : <AddToQueueIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        {/* Heart rating button - bottom right */}
        {!hideHeartRating && (
          <Box
            onClick={(e) => {
              // Stop propagation so clicking heart doesn't trigger poster onClick
              e.stopPropagation()
            }}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              zIndex: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '50%',
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
              },
            }}
          >
            <HeartRating
              value={userRating ?? null}
              onChange={onRate}
              size="small"
              readOnly={!onRate}
            />
          </Box>
        )}

        {/* Custom children (for badges like play count, favorite icon, etc.) */}
        {children}

        {/* Hover overlay with details */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.4) 100%)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            p: 1.5,
            zIndex: 1,
          }}
        >
          {/* Year badge */}
          {year && (
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                mb: 0.5,
              }}
            >
              {year}
            </Typography>
          )}

          {/* Title */}
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              color: 'white',
              lineHeight: 1.2,
              mb: 0.5,
            }}
          >
            {title}
          </Typography>

          {/* Overview */}
          {overview && (
            <Typography
              variant="caption"
              sx={{
                color: 'grey.300',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: overviewLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: '0.7rem',
              }}
            >
              {overview}
            </Typography>
          )}

          {/* Genres */}
          {genres && genres.length > 0 && (
            <Typography
              variant="caption"
              sx={{
                color: 'grey.500',
                mt: 0.5,
                fontSize: '0.65rem',
              }}
            >
              {genres.slice(0, 3).join(' • ')}
            </Typography>
          )}
        </Box>

        {/* Personalized match score badge - only on recommendations */}
        {showScore && score !== undefined && score !== null && (
          <Tooltip
            title="How well this movie matches your taste based on your watch history, preferences, and viewing patterns"
            arrow
            placement="bottom"
          >
            <Chip
              label={`${(score * 100).toFixed(0)}% Match`}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                fontWeight: 700,
                fontSize: '0.7rem',
                height: 24,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
                color: 'white',
                zIndex: 3,
                '& .MuiChip-label': {
                  px: 1,
                },
              }}
            />
          </Tooltip>
        )}
      </Paper>

      {/* Title and metadata below poster - only when not hovered */}
      <Box 
        mt={1}
        sx={{
          opacity: isHovered ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={500}
          noWrap
          title={title}
          sx={{ lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {year || 'Unknown year'}
        </Typography>
        {genres && genres.length > 0 && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {genres[0]}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

