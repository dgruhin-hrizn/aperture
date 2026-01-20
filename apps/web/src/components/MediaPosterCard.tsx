import React, { useState } from 'react'
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Skeleton,
  alpha,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { RankBadge } from '@aperture/ui'
import { Link } from 'react-router-dom'

const FALLBACK_POSTER = '/NO_POSTER_FOUND.png'

export interface JellyseerrStatus {
  requested: boolean
  requestStatus?: 'pending' | 'approved' | 'declined' | 'unknown'
}

export interface Genre {
  id: number
  name: string
}

export interface MediaPosterCardProps {
  tmdbId: number
  title: string
  year?: number | null
  posterUrl?: string | null
  rank?: number
  mediaType: 'movie' | 'series'

  // Library status
  inLibrary?: boolean
  libraryId?: string | null // For linking to detail page

  // Jellyseerr status
  jellyseerrStatus?: JellyseerrStatus
  canRequest?: boolean
  isRequesting?: boolean
  onRequest?: () => void

  // Optional extras (for Discovery page / rich display)
  sourceLabel?: string
  sourceColor?: string
  matchScore?: number
  overview?: string | null
  voteAverage?: number | null
  genres?: Genre[]

  // Detail popper support
  onShowDetails?: () => void

  // Click behavior
  onClick?: () => void
}

export function MediaPosterCard({
  tmdbId,
  title,
  year,
  posterUrl,
  rank,
  mediaType,
  inLibrary = false,
  libraryId,
  jellyseerrStatus,
  canRequest = false,
  isRequesting = false,
  onRequest,
  sourceLabel,
  sourceColor,
  matchScore,
  overview,
  voteAverage,
  genres,
  onShowDetails,
  onClick,
}: MediaPosterCardProps) {
  const [hovering, setHovering] = useState(false)
  const [imageError, setImageError] = useState(false)

  const finalPosterUrl = posterUrl && !imageError ? posterUrl : FALLBACK_POSTER
  const isRequested = jellyseerrStatus?.requested || false
  const requestStatus = jellyseerrStatus?.requestStatus

  // Determine if the item should be greyed out (already requested but not in library)
  const isGreyedOut = isRequested && !inLibrary

  const handleRequest = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isRequesting && !isRequested && canRequest && onRequest) {
      onRequest()
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault()
      onClick()
    }
  }

  // Build the detail link for library items
  const detailPath = inLibrary && libraryId
    ? mediaType === 'movie' ? `/movies/${libraryId}` : `/series/${libraryId}`
    : undefined

  // TMDb link for non-library items
  const tmdbUrl = mediaType === 'movie'
    ? `https://www.themoviedb.org/movie/${tmdbId}`
    : `https://www.themoviedb.org/tv/${tmdbId}`

  // Determine if we should show extended info (overview, genres, etc.)
  const showExtendedInfo = overview !== undefined || voteAverage !== undefined || genres !== undefined

  const cardContent = (
    <Card
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
        cursor: 'pointer',
        opacity: isGreyedOut ? 0.6 : 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.common.black, 0.3)}`,
        },
      }}
      onClick={handleCardClick}
    >
      {/* Poster */}
      <Box sx={{ position: 'relative', aspectRatio: '2/3' }}>
        <CardMedia
          component="img"
          image={finalPosterUrl}
          alt={title}
          onError={() => setImageError(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: isGreyedOut ? 'grayscale(80%)' : 'none',
            transition: 'filter 0.2s',
          }}
        />

        {/* Fallback icon when no poster */}
        {imageError && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'action.hover',
            }}
          >
            {mediaType === 'movie' ? (
              <MovieIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            ) : (
              <TvIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            )}
          </Box>
        )}

        {/* Rank Badge */}
        {rank !== undefined && <RankBadge rank={rank} size="medium" />}

        {/* Source Chip (for Discovery) */}
        {sourceLabel && (
          <Chip
            label={sourceLabel}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: alpha(sourceColor || '#6366f1', 0.9),
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        )}

        {/* Match Score (for Discovery) */}
        {matchScore !== undefined && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: alpha('#000', 0.75),
              borderRadius: 1,
              px: 1,
              py: 0.5,
            }}
          >
            <Typography variant="caption" fontWeight={600} color="white">
              {(matchScore * 100).toFixed(0)}% Match
            </Typography>
          </Box>
        )}

        {/* In Library Badge (visible without hover) */}
        {inLibrary && !hovering && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              backgroundColor: alpha('#22c55e', 0.9),
              borderRadius: 1,
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 14, color: 'white' }} />
            <Typography variant="caption" fontWeight={600} color="white">
              In Library
            </Typography>
          </Box>
        )}

        {/* Already Requested Badge (visible without hover, for non-library items) */}
        {!inLibrary && isRequested && !hovering && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              backgroundColor: requestStatus === 'declined'
                ? alpha('#ef4444', 0.9)
                : alpha('#8B5CF6', 0.9), // Aperture purple for requested/pending/approved
              borderRadius: 1,
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <HourglassEmptyIcon sx={{ fontSize: 14, color: 'white' }} />
            <Typography variant="caption" fontWeight={600} color="white">
              {requestStatus === 'declined' ? 'Declined' : 'Requested'}
            </Typography>
          </Box>
        )}

        {/* Hover Overlay with Request Button */}
        {hovering && canRequest && !inLibrary && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha('#000', 0.6),
            }}
            onClick={handleRequest}
          >
            {isRequesting ? (
              <CircularProgress size={40} sx={{ color: 'white' }} />
            ) : isRequested ? (
              <Box textAlign="center">
                <HourglassEmptyIcon sx={{ fontSize: 40, color: '#8B5CF6' }} />
                <Typography variant="caption" color="white" display="block">
                  {requestStatus === 'declined' ? 'Declined' : 'Requested'}
                </Typography>
              </Box>
            ) : (
              <Box textAlign="center">
                <IconButton
                  sx={{
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                    width: 56,
                    height: 56,
                  }}
                >
                  <AddIcon sx={{ fontSize: 32 }} />
                </IconButton>
                <Typography variant="caption" color="white" display="block" mt={1}>
                  Request
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Hover Overlay for Library Items - just shows "In Library" */}
        {hovering && inLibrary && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha('#000', 0.5),
            }}
          >
            <Box textAlign="center">
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
              <Typography variant="caption" color="white" display="block">
                In Library
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Info */}
      <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
        <Typography
          variant="subtitle2"
          fontWeight={600}
          noWrap
          sx={{ lineHeight: 1.3, mb: 0.5, color: isGreyedOut ? 'text.disabled' : 'text.primary' }}
          title={title}
        >
          {title}
        </Typography>
        
        {/* Extended info row with year, rating, and action buttons */}
        {showExtendedInfo ? (
          <>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {year || 'TBA'}
                {voteAverage && ` • ${voteAverage.toFixed(1)}★`}
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                {onShowDetails && (
                  <Tooltip title="View details">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onShowDetails()
                      }}
                      sx={{ p: 0.5 }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="View on TMDb">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      window.open(tmdbUrl, '_blank')
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            {overview ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.4,
                  mt: 0.5,
                }}
              >
                {overview}
              </Typography>
            ) : genres && genres.filter(g => g.name).length > 0 ? (
              <Typography variant="caption" color="text.secondary" noWrap display="block" mt={0.5}>
                {genres.filter(g => g.name).slice(0, 3).map(g => g.name).join(' • ')}
              </Typography>
            ) : genres && genres.length > 0 ? (
              <Skeleton variant="text" width="70%" sx={{ mt: 0.5 }} />
            ) : null}
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {year || 'Unknown year'}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  // Wrap in Link for library items, otherwise just return the card
  if (detailPath) {
    return (
      <Link to={detailPath} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {cardContent}
      </Link>
    )
  }

  // For non-library items, clicking opens TMDb (unless custom onClick provided)
  if (!onClick) {
    return (
      <Box
        component="a"
        href={tmdbUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ textDecoration: 'none', display: 'block', height: '100%' }}
      >
        {cardContent}
      </Box>
    )
  }

  return cardContent
}
