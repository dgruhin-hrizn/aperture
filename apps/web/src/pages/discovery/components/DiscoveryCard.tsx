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
  alpha,
  Skeleton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { RankBadge } from '@aperture/ui'
import { DiscoveryDetailPopper } from './DiscoveryDetailPopper'
import { SeasonSelectModal, type SeasonInfo } from './SeasonSelectModal'
import type { DiscoveryCandidate, JellyseerrMediaStatus } from '../types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'
const FALLBACK_POSTER = '/NO_POSTER_FOUND.png'

interface DiscoveryCardProps {
  candidate: DiscoveryCandidate
  canRequest: boolean
  onRequest: (candidate: DiscoveryCandidate, seasons?: number[]) => Promise<void>
  isRequesting: boolean
  cachedStatus?: JellyseerrMediaStatus
  fetchTVDetails?: (tmdbId: number) => Promise<{ seasons: SeasonInfo[]; title: string; posterPath?: string } | null>
}

export function DiscoveryCard({
  candidate,
  canRequest,
  onRequest,
  isRequesting,
  cachedStatus,
  fetchTVDetails,
}: DiscoveryCardProps) {
  const [hovering, setHovering] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  
  // Season selection modal state
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)
  const [seasonModalLoading, setSeasonModalLoading] = useState(false)
  const [seasonData, setSeasonData] = useState<{ seasons: SeasonInfo[]; title: string; posterPath?: string } | null>(null)

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
    return '#6366f1'
  }

  const handleRequest = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isRequesting && !isRequested && canRequest) {
      // For series, open the season selection modal
      if (candidate.mediaType === 'series' && fetchTVDetails) {
        setSeasonModalLoading(true)
        setSeasonModalOpen(true)
        const details = await fetchTVDetails(candidate.tmdbId)
        setSeasonData(details)
        setSeasonModalLoading(false)
      } else {
        // For movies, request directly
        await onRequest(candidate)
      }
    }
  }

  const handleSeasonSubmit = async (seasons: number[]) => {
    await onRequest(candidate, seasons)
  }

  // IMDb URL if available, fallback to TMDb
  const imdbUrl = candidate.imdbId ? `https://www.imdb.com/title/${candidate.imdbId}` : null
  const tmdbUrl = candidate.mediaType === 'movie'
    ? `https://www.themoviedb.org/movie/${candidate.tmdbId}`
    : `https://www.themoviedb.org/tv/${candidate.tmdbId}`
  const primaryUrl = imdbUrl || tmdbUrl

  return (
    <Card
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.common.black, 0.3)}`,
        },
      }}
      onClick={() => !seasonModalOpen && window.open(primaryUrl, '_blank')}
    >
      {/* Poster */}
      <Box sx={{ position: 'relative', aspectRatio: '2/3' }}>
        <CardMedia
          component="img"
          image={posterUrl}
          alt={candidate.title}
          onError={() => setImageError(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Rank Badge */}
        <RankBadge rank={candidate.rank} size="medium" />

        {/* Source Chip */}
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
            fontSize: '0.7rem',
            height: 22,
          }}
        />

        {/* Score */}
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
            {(candidate.finalScore * 100).toFixed(0)}% Match
          </Typography>
        </Box>

        {/* Already Requested Badge (visible without hover) */}
        {isRequested && !hovering && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              backgroundColor: requestStatus === 'approved' 
                ? alpha('#22c55e', 0.9) 
                : requestStatus === 'declined'
                ? alpha('#ef4444', 0.9)
                : alpha('#8B5CF6', 0.9), // Aperture purple for pending
              borderRadius: 1,
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {requestStatus === 'approved' ? (
              <CheckIcon sx={{ fontSize: 14, color: 'white' }} />
            ) : (
              <HourglassEmptyIcon sx={{ fontSize: 14, color: 'white' }} />
            )}
            <Typography variant="caption" fontWeight={600} color="white">
              {requestStatus === 'approved' ? 'Approved' : requestStatus === 'declined' ? 'Declined' : 'Requested'}
            </Typography>
          </Box>
        )}

        {/* Request Button Overlay */}
        {hovering && canRequest && (
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
                {requestStatus === 'approved' ? (
                  <CheckIcon sx={{ fontSize: 40, color: 'success.main' }} />
                ) : (
                  <HourglassEmptyIcon sx={{ fontSize: 40, color: '#8B5CF6' }} />
                )}
                <Typography variant="caption" color="white" display="block">
                  {requestStatus === 'approved' ? 'Approved' : requestStatus === 'declined' ? 'Declined' : 'Requested'}
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
      </Box>

      {/* Info */}
      <CardContent sx={{ p: 1.5 }}>
        <Typography
          variant="subtitle2"
          fontWeight={600}
          noWrap
          sx={{ lineHeight: 1.3, mb: 0.5 }}
        >
          {candidate.title}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {candidate.releaseYear || 'TBA'}
            {candidate.voteAverage && ` • ${candidate.voteAverage.toFixed(1)}★`}
          </Typography>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Tooltip title="View details">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setDetailOpen(true)
                }}
                sx={{ p: 0.5 }}
              >
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={imdbUrl ? "View on IMDb" : "View on TMDb"}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(primaryUrl, '_blank')
                }}
                sx={{ p: 0.5 }}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {candidate.overview ? (
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
            {candidate.overview}
          </Typography>
        ) : candidate.genres.filter(g => g.name).length > 0 ? (
          <Typography variant="caption" color="text.secondary" noWrap display="block" mt={0.5}>
            {candidate.genres.filter(g => g.name).slice(0, 3).map(g => g.name).join(' • ')}
          </Typography>
        ) : candidate.genres.length > 0 ? (
          <Skeleton variant="text" width="70%" sx={{ mt: 0.5 }} />
        ) : null}
      </CardContent>

      {/* Detail Popper */}
      <DiscoveryDetailPopper
        candidate={candidate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Season Selection Modal (for series) */}
      <SeasonSelectModal
        open={seasonModalOpen}
        onClose={() => {
          setSeasonModalOpen(false)
          setSeasonData(null)
        }}
        onSubmit={handleSeasonSubmit}
        title={seasonData?.title || candidate.title}
        posterPath={seasonData?.posterPath || candidate.posterPath}
        seasons={seasonData?.seasons || []}
        loading={seasonModalLoading}
      />
    </Card>
  )
}

