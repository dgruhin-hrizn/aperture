import React, { useState } from 'react'
import { Box } from '@mui/material'
import { MediaPosterCard, type Genre } from '../../../components/MediaPosterCard'
import { DiscoveryDetailPopper } from './DiscoveryDetailPopper'
import { SeasonSelectModal, type SeasonInfo } from './SeasonSelectModal'
import type { DiscoveryCandidate, JellyseerrMediaStatus } from '../types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

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
  const [detailOpen, setDetailOpen] = useState(false)
  
  // Season selection modal state
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)
  const [seasonModalLoading, setSeasonModalLoading] = useState(false)
  const [seasonData, setSeasonData] = useState<{ seasons: SeasonInfo[]; title: string; posterPath?: string } | null>(null)

  const posterUrl = candidate.posterPath
    ? `${TMDB_IMAGE_BASE}${candidate.posterPath}`
    : null

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

  const handleRequest = async () => {
    if (!isRequesting && !cachedStatus?.requested && canRequest) {
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

  // Convert cachedStatus to JellyseerrStatus format for MediaPosterCard
  const jellyseerrStatus = cachedStatus ? {
    requested: cachedStatus.requested,
    requestStatus: cachedStatus.requestStatus,
  } : undefined

  // Convert genres to the format MediaPosterCard expects
  const genres: Genre[] = candidate.genres.map(g => ({ id: g.id, name: g.name }))

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <MediaPosterCard
        tmdbId={candidate.tmdbId}
        title={candidate.title}
        year={candidate.releaseYear}
        posterUrl={posterUrl}
        rank={candidate.rank}
        mediaType={candidate.mediaType === 'movie' ? 'movie' : 'series'}
        inLibrary={false}
        jellyseerrStatus={jellyseerrStatus}
        canRequest={canRequest}
        isRequesting={isRequesting}
        onRequest={handleRequest}
        sourceLabel={getSourceLabel(candidate.source)}
        sourceColor={getSourceColor(candidate.source)}
        matchScore={candidate.finalScore}
        overview={candidate.overview}
        voteAverage={candidate.voteAverage}
        genres={genres}
        onShowDetails={() => setDetailOpen(true)}
        onClick={() => !seasonModalOpen && window.open(primaryUrl, '_blank')}
      />

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
    </Box>
  )
}
