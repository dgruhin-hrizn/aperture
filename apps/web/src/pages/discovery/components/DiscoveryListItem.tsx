import React, { useState } from 'react'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme,
  LinearProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import StarIcon from '@mui/icons-material/Star'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { RankBadge } from '@aperture/ui'
import { DiscoveryDetailPopper } from './DiscoveryDetailPopper'
import type { DiscoveryCandidate, JellyseerrMediaStatus } from '../types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
const FALLBACK_POSTER = '/NO_POSTER_FOUND.png'

interface DiscoveryListItemProps {
  candidate: DiscoveryCandidate
  canRequest: boolean
  onRequest: (candidate: DiscoveryCandidate) => Promise<void>
  isRequesting: boolean
  cachedStatus?: JellyseerrMediaStatus
}

export function DiscoveryListItem({
  candidate,
  canRequest,
  onRequest,
  isRequesting,
  cachedStatus,
}: DiscoveryListItemProps) {
  const theme = useTheme()
  const [imageError, setImageError] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const posterUrl = candidate.posterPath && !imageError
    ? `${TMDB_IMAGE_BASE}${candidate.posterPath}`
    : FALLBACK_POSTER

  const isRequested = cachedStatus?.requested || false
  const requestStatus = cachedStatus?.requestStatus

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      tmdb_recommendations: 'TMDb Recommended',
      tmdb_similar: 'Similar Titles',
      tmdb_discover: 'Popular',
      trakt_trending: 'Trending',
      trakt_popular: 'Popular',
      trakt_recommendations: 'Trakt Pick',
      mdblist: 'MDBList',
    }
    return labels[source] || source
  }

  const getSourceColor = (source: string) => {
    if (source.startsWith('tmdb')) return '#01b4e4'
    if (source.startsWith('trakt')) return '#ed1c24'
    return theme.palette.primary.main
  }

  const handleRequest = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isRequesting && !isRequested && canRequest) {
      await onRequest(candidate)
    }
  }

  // IMDb URL if available, fallback to TMDb
  const imdbUrl = candidate.imdbId ? `https://www.imdb.com/title/${candidate.imdbId}` : null
  const tmdbUrl = candidate.mediaType === 'movie'
    ? `https://www.themoviedb.org/movie/${candidate.tmdbId}`
    : `https://www.themoviedb.org/tv/${candidate.tmdbId}`
  const primaryUrl = imdbUrl || tmdbUrl

  const matchPercent = Math.round(candidate.finalScore * 100)

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        onClick={() => window.open(primaryUrl, '_blank')}
        sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}
      >
        {/* Poster Section */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: '100%', md: 100 },
            height: { xs: 200, md: 150 },
            flexShrink: 0,
            overflow: 'hidden',
            bgcolor: 'grey.900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={posterUrl}
            alt={candidate.title}
            onError={() => setImageError(true)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <RankBadge rank={candidate.rank} size="medium" />
          
          {/* Source badge */}
          <Chip
            label={getSourceLabel(candidate.source)}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: alpha(getSourceColor(candidate.source), 0.9),
              color: 'white',
              fontWeight: 600,
              fontSize: '0.65rem',
              height: 20,
              zIndex: 2,
            }}
          />
        </Box>

        {/* Content Section */}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {candidate.title}
            </Typography>
            {isRequested && (
              <Chip
                icon={requestStatus === 'approved' ? <CheckIcon sx={{ fontSize: 14 }} /> : <HourglassEmptyIcon sx={{ fontSize: 14 }} />}
                label={requestStatus === 'approved' ? 'Approved' : requestStatus === 'declined' ? 'Declined' : 'Requested'}
                size="small"
                sx={{
                  backgroundColor: requestStatus === 'approved'
                    ? alpha('#22c55e', 0.2)
                    : requestStatus === 'declined'
                    ? alpha('#ef4444', 0.2)
                    : alpha('#8B5CF6', 0.2),
                  color: requestStatus === 'approved'
                    ? '#22c55e'
                    : requestStatus === 'declined'
                    ? '#ef4444'
                    : '#8B5CF6',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              />
            )}
          </Box>
          
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {candidate.releaseYear && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {candidate.releaseYear}
                </Typography>
              </Box>
            )}
            {candidate.voteAverage && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary">
                  {candidate.voteAverage.toFixed(1)}
                </Typography>
              </Box>
            )}
            {candidate.runtimeMinutes && (
              <Typography variant="body2" color="text.secondary">
                • {candidate.runtimeMinutes} min
              </Typography>
            )}
          </Box>
          
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
            {candidate.genres.slice(0, 4).map((genre) => (
              <Chip
                key={genre.id}
                label={genre.name}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            ))}
          </Box>
          
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {candidate.overview || 'No description available.'}
          </Typography>
        </CardContent>
      </CardActionArea>

      {/* Match Score & Actions Panel */}
      <Box
        sx={{
          width: { xs: '100%', md: 180 },
          flexShrink: 0,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: { xs: 'stretch', md: 'center' },
          textAlign: 'center',
          borderLeft: { xs: 0, md: 1 },
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
          bgcolor: 'background.default',
          gap: 1.5,
        }}
      >
        {/* Match Score */}
        <Box>
          <Typography variant="h4" fontWeight={700} color="primary.main">
            {matchPercent}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Match Score
          </Typography>
          <LinearProgress
            variant="determinate"
            value={matchPercent}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        </Box>

        {/* Actions */}
        <Box display="flex" justifyContent="center" gap={1}>
          {canRequest && (
            <Tooltip title={isRequested ? (requestStatus === 'approved' ? 'Already approved' : 'Already requested') : 'Request this title'}>
              <span>
                <IconButton
                  onClick={handleRequest}
                  disabled={isRequesting || isRequested}
                  sx={{
                    backgroundColor: isRequested
                      ? (requestStatus === 'approved' ? alpha('#22c55e', 0.2) : alpha('#8B5CF6', 0.2))
                      : alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      backgroundColor: isRequested
                        ? undefined
                        : alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  {isRequesting ? (
                    <CircularProgress size={20} />
                  ) : isRequested ? (
                    requestStatus === 'approved' ? <CheckIcon /> : <HourglassEmptyIcon />
                  ) : (
                    <AddIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          
          <Tooltip title="View details">
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                setDetailOpen(true)
              }}
              sx={{
                backgroundColor: alpha(theme.palette.info.main, 0.1),
                '&:hover': { backgroundColor: alpha(theme.palette.info.main, 0.2) },
              }}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={imdbUrl ? 'View on IMDb' : 'View on TMDb'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                window.open(primaryUrl, '_blank')
              }}
              sx={{
                backgroundColor: alpha(theme.palette.grey[500], 0.1),
                '&:hover': { backgroundColor: alpha(theme.palette.grey[500], 0.2) },
              }}
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Detail Popper */}
      <DiscoveryDetailPopper
        candidate={candidate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Card>
  )
}
