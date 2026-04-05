import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import { MediaPosterCard, type Genre } from '../../../components/MediaPosterCard'
import { RequestSeerrOptionsDialog } from '../../../components/RequestSeerrOptionsDialog'
import { DiscoveryDetailPopper } from './DiscoveryDetailPopper'
import { SeasonSelectModal, type SeasonInfo } from './SeasonSelectModal'
import type { SeerrRequestOptions } from '../../../types/seerrRequest'
import type { DiscoveryCandidate, SeerrMediaStatus } from '../types'
import type { ResolveDiscoveryGenreName } from '../hooks'
import { discoverySourceLabel } from '../discoveryLabels'

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
  resolveGenreName: ResolveDiscoveryGenreName
  /** Local library item (e.g. streaming charts): dim card, link to detail */
  inLibrary?: boolean
  libraryId?: string | null
  /** Hide numeric rank badge (streaming charts use trend icons instead) */
  showRank?: boolean
}

export function DiscoveryCard({
  candidate,
  canRequest,
  onRequest,
  isRequesting,
  cachedStatus,
  fetchTVDetails,
  resolveGenreName,
  inLibrary = false,
  libraryId = null,
  showRank = true,
}: DiscoveryCardProps) {
  const { t } = useTranslation()
  const [detailOpen, setDetailOpen] = useState(false)
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false)
  const [pendingSeerrOpts, setPendingSeerrOpts] = useState<SeerrRequestOptions | null>(null)
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)
  const [seasonModalLoading, setSeasonModalLoading] = useState(false)
  const [seasonData, setSeasonData] = useState<{ seasons: SeasonInfo[]; title: string; posterPath?: string } | null>(null)

  const posterUrl = candidate.posterPath
    ? candidate.posterPath.startsWith('http')
      ? candidate.posterPath
      : `${TMDB_IMAGE_BASE}${candidate.posterPath}`
    : null

  const getSourceColor = (source: string) => {
    if (source.startsWith('tmdb')) return '#01b4e4'
    if (source.startsWith('trakt')) return '#ed1c24'
    if (source.startsWith('justwatch')) return '#0ea5e9'
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

  // Convert cachedStatus to SeerrStatus format for MediaPosterCard
  const seerrStatus = cachedStatus ? {
    requested: cachedStatus.requested,
    requestStatus: cachedStatus.requestStatus,
  } : undefined

  // Convert genres to the format MediaPosterCard expects (TMDb-localized labels)
  const genres: Genre[] = candidate.genres.map((g) => ({
    id: g.id,
    name: resolveGenreName(g.id, g.name),
  }))

  const isStreamingCharts = candidate.source === 'justwatch_streaming'
  const isTmdbGenreStrip = candidate.source === 'tmdb_genre_row'
  const hideSourceAndMatch = isStreamingCharts || isTmdbGenreStrip

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <MediaPosterCard
        tmdbId={candidate.tmdbId}
        title={candidate.title}
        year={candidate.releaseYear}
        posterUrl={posterUrl}
        rank={showRank ? candidate.rank : undefined}
        mediaType={candidate.mediaType === 'movie' ? 'movie' : 'series'}
        inLibrary={inLibrary}
        showInLibraryCornerBadge={!isStreamingCharts}
        libraryId={libraryId ?? undefined}
        seerrStatus={seerrStatus}
        canRequest={canRequest}
        isRequesting={isRequesting}
        onRequest={handleRequest}
        sourceLabel={hideSourceAndMatch ? undefined : discoverySourceLabel(candidate.source, t)}
        sourceColor={hideSourceAndMatch ? undefined : getSourceColor(candidate.source)}
        matchScore={hideSourceAndMatch ? undefined : candidate.finalScore}
        overview={candidate.overview}
        voteAverage={candidate.voteAverage}
        genres={genres}
        onShowDetails={() => setDetailOpen(true)}
        onClick={() => !seasonModalOpen && !optionsDialogOpen && setDetailOpen(true)}
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
        resolveGenreName={resolveGenreName}
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
