import React, { useState } from 'react'
import { Box } from '@mui/material'
import { MediaPosterCard, type Genre } from '../../../components/MediaPosterCard'
import { RequestSeerrOptionsDialog } from '../../../components/RequestSeerrOptionsDialog'
import { DiscoveryDetailPopper } from './DiscoveryDetailPopper'
import { SeasonSelectModal, type SeasonInfo } from './SeasonSelectModal'
import type { SeerrRequestOptions } from '../../../types/seerrRequest'
import type { DiscoveryCandidate, SeerrMediaStatus } from '../types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

interface DiscoveryCardProps {
  candidate: DiscoveryCandidate
  canRequest: boolean
  onRequest: (
    candidate: DiscoveryCandidate,
    seasons?: number[],
    seerrOptions?: SeerrRequestOptions
  ) => Promise<void>
  isRequesting: boolean
  cachedStatus?: SeerrMediaStatus
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
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false)
  const [pendingSeerrOpts, setPendingSeerrOpts] = useState<SeerrRequestOptions | null>(null)
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

  const handleRequest = () => {
    if (!isRequesting && !cachedStatus?.requested && canRequest) {
      setOptionsDialogOpen(true)
    }
  }

  const handleOptionsConfirm = async (opts: SeerrRequestOptions) => {
    setOptionsDialogOpen(false)
    if (candidate.mediaType === 'movie') {
      await onRequest(candidate, undefined, opts)
      return
    }
    if (fetchTVDetails) {
      setPendingSeerrOpts(opts)
      setSeasonModalLoading(true)
      setSeasonModalOpen(true)
      const details = await fetchTVDetails(candidate.tmdbId)
      setSeasonData(details)
      setSeasonModalLoading(false)
    }
  }

  const handleSeasonSubmit = async (seasons: number[]) => {
    await onRequest(candidate, seasons, pendingSeerrOpts ?? undefined)
  }

  // IMDb URL if available, fallback to TMDb
  const imdbUrl = candidate.imdbId ? `https://www.imdb.com/title/${candidate.imdbId}` : null
  const tmdbUrl = candidate.mediaType === 'movie'
    ? `https://www.themoviedb.org/movie/${candidate.tmdbId}`
    : `https://www.themoviedb.org/tv/${candidate.tmdbId}`
  const primaryUrl = imdbUrl || tmdbUrl

  // Convert cachedStatus to SeerrStatus format for MediaPosterCard
  const seerrStatus = cachedStatus ? {
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
        seerrStatus={seerrStatus}
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
        onClick={() => !seasonModalOpen && !optionsDialogOpen && window.open(primaryUrl, '_blank')}
      />

      <RequestSeerrOptionsDialog
        open={optionsDialogOpen}
        mediaType={candidate.mediaType === 'movie' ? 'movie' : 'series'}
        title={candidate.title}
        onClose={() => setOptionsDialogOpen(false)}
        onConfirm={handleOptionsConfirm}
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
          setPendingSeerrOpts(null)
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
