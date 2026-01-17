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
  useMediaQuery,
  LinearProgress,
  Skeleton,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
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

  const handleActionsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: { xs: 'none', md: 'translateY(-2px)' },
          boxShadow: { xs: 1, md: 4 },
        },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Main row: Poster + Content + Desktop Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        <CardActionArea
          onClick={() => window.open(primaryUrl, '_blank')}
          sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}
        >
          {/* Poster Section */}
          <Box
            sx={{
              position: 'relative',
              width: { xs: 100, sm: 110, md: 120 },
              alignSelf: 'stretch',
              flexShrink: 0,
              overflow: 'hidden',
              bgcolor: 'grey.900',
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
            <RankBadge rank={candidate.rank} size={isMobile ? 'medium' : 'large'} />
            
            {/* Source badge - desktop only */}
            {!isMobile && (
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
            )}
          </Box>

          {/* Content Section */}
          <CardContent
            sx={{
              flexGrow: 1,
              p: { xs: 1.5, md: 2 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
              '&:last-child': { pb: { xs: 1.5, md: 2 } },
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography
                variant={isMobile ? 'body1' : 'h6'}
                fontWeight={600}
                noWrap
                sx={{ flex: 1, fontSize: { xs: '0.95rem', md: '1.25rem' } }}
              >
                {candidate.title}
              </Typography>
              {isRequested && !isMobile && (
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
            
            <Box display="flex" alignItems="center" gap={{ xs: 0.75, md: 1 }} mb={{ xs: 0.5, md: 1 }} flexWrap="wrap">
              {candidate.releaseYear && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CalendarTodayIcon sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {candidate.releaseYear}
                  </Typography>
                </Box>
              )}
              {candidate.voteAverage && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StarIcon sx={{ fontSize: { xs: 12, md: 14 }, color: '#fbbf24' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {candidate.voteAverage.toFixed(1)}
                  </Typography>
                </Box>
              )}
              {candidate.runtimeMinutes && !isMobile && (
                <Typography variant="body2" color="text.secondary">
                  • {candidate.runtimeMinutes} min
                </Typography>
              )}
              {/* Mobile: Show source inline */}
              {isMobile && (
                <Chip
                  label={getSourceLabel(candidate.source)}
                  size="small"
                  sx={{
                    backgroundColor: alpha(getSourceColor(candidate.source), 0.15),
                    color: getSourceColor(candidate.source),
                    fontWeight: 600,
                    fontSize: '0.6rem',
                    height: 16,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
            </Box>
            
            <Box display="flex" gap={0.5} flexWrap="wrap" mb={{ xs: 0.5, md: 1 }}>
              {candidate.genres.slice(0, isMobile ? 2 : 4).map((genre) => (
                genre.name ? (
                  <Chip
                    key={genre.id}
                    label={genre.name}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: { xs: '0.65rem', md: '0.7rem' },
                      height: { xs: 18, md: 22 },
                      '& .MuiChip-label': { px: { xs: 0.75, md: 1 } },
                    }}
                  />
                ) : (
                  <Skeleton
                    key={genre.id}
                    variant="rounded"
                    width={60}
                    height={isMobile ? 18 : 22}
                    sx={{ borderRadius: '16px' }}
                  />
                )
              ))}
              {candidate.genres.length === 0 && (
                <>
                  <Skeleton variant="rounded" width={60} height={isMobile ? 18 : 22} sx={{ borderRadius: '16px' }} />
                  <Skeleton variant="rounded" width={70} height={isMobile ? 18 : 22} sx={{ borderRadius: '16px' }} />
                </>
              )}
            </Box>
            
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: { xs: '0.75rem', md: '0.875rem' },
              }}
            >
              {candidate.overview || 'No description available.'}
            </Typography>

            {/* Mobile: Inline actions */}
            {isMobile && (
              <Box display="flex" alignItems="center" gap={1} mt={1} onClick={handleActionsClick}>
                {canRequest && (
                  <Tooltip title={isRequested ? (requestStatus === 'approved' ? 'Already approved' : 'Already requested') : 'Request this title'}>
                    <span>
                      <IconButton
                        onClick={handleRequest}
                        disabled={isRequesting || isRequested}
                        size="small"
                        sx={{
                          p: 0.5,
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
                          <CircularProgress size={16} />
                        ) : isRequested ? (
                          requestStatus === 'approved' ? <CheckIcon sx={{ fontSize: 16 }} /> : <HourglassEmptyIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <AddIcon sx={{ fontSize: 16 }} />
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
                    size="small"
                    sx={{
                      p: 0.5,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      '&:hover': { backgroundColor: alpha(theme.palette.info.main, 0.2) },
                    }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={imdbUrl ? 'View on IMDb' : 'View on TMDb'}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(primaryUrl, '_blank')
                    }}
                    size="small"
                    sx={{
                      p: 0.5,
                      backgroundColor: alpha(theme.palette.grey[500], 0.1),
                      '&:hover': { backgroundColor: alpha(theme.palette.grey[500], 0.2) },
                    }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                {isRequested && (
                  <Chip
                    icon={requestStatus === 'approved' ? <CheckIcon sx={{ fontSize: 12 }} /> : <HourglassEmptyIcon sx={{ fontSize: 12 }} />}
                    label={requestStatus === 'approved' ? 'Approved' : 'Requested'}
                    size="small"
                    sx={{
                      ml: 'auto',
                      backgroundColor: requestStatus === 'approved'
                        ? alpha('#22c55e', 0.2)
                        : alpha('#8B5CF6', 0.2),
                      color: requestStatus === 'approved'
                        ? '#22c55e'
                        : '#8B5CF6',
                      fontWeight: 600,
                      fontSize: '0.6rem',
                      height: 20,
                    }}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </CardActionArea>

        {/* Desktop: Match Score & Actions Panel */}
        {!isMobile && (
          <Box
            sx={{
              width: 180,
              flexShrink: 0,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              borderLeft: 1,
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
        )}
      </Box>

      {/* Mobile: Full-width Match Score Section */}
      {isMobile && (
        <Box
          sx={{
            p: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {matchPercent}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Match Score
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={matchPercent}
            sx={{
              flex: 1,
              maxWidth: 120,
              height: 4,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        </Box>
      )}

      {/* Detail Popper */}
      <DiscoveryDetailPopper
        candidate={candidate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Card>
  )
}
