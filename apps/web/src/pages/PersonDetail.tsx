import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonIcon from '@mui/icons-material/Person'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VideocamIcon from '@mui/icons-material/Videocam'
import {
  MoviePoster,
  BaseCarousel,
  CarouselItem,
  getProxiedImageUrl,
} from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'
import { RotatingBackdrop } from '../components/RotatingBackdrop'
import { MediaPosterCard } from '../components/MediaPosterCard'
import { SeasonSelectModal, type SeasonInfo } from './discovery/components/SeasonSelectModal'
import { useSeerrRequest } from './discovery/hooks/useSeerrRequest'
import { RequestSeerrOptionsDialog } from '../components/RequestSeerrOptionsDialog'
import type { SeerrRequestOptions } from '../types/seerrRequest'
import {
  TmdbExternalDetailModal,
  type TmdbExternalDetailPayload,
} from '../components/TmdbExternalDetailModal'

interface ContentItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  communityRating: number | null
  role?: string
}

interface PersonData {
  name: string
  imageUrl: string | null
  tmdbFallbackImageUrl?: string | null
  movies: ContentItem[]
  series: ContentItem[]
  stats: {
    totalMovies: number
    totalSeries: number
    asActor: number
    asDirector: number
  }
}

interface CreditsGapRow {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  groupKey: string
  roleKind: string
  title: string
  year: number | null
  posterUrl: string | null
}

interface CreditsGapGroup {
  groupKey: string
  label: string
  rows: CreditsGapRow[]
}

interface CreditsGapResponse {
  tmdbPersonId: number | null
  inLibrary: CreditsGapGroup[]
  missing: CreditsGapGroup[]
}

interface SeerrBatchStatus {
  exists: boolean
  status: string
  requested: boolean
  requestStatus?: string
}

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p'

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

export function PersonDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const [data, setData] = useState<PersonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avatarPhase, setAvatarPhase] = useState<'media' | 'tmdb' | 'initials'>('media')
  const [creditsGap, setCreditsGap] = useState<CreditsGapResponse | null>(null)
  const [creditsGapLoading, setCreditsGapLoading] = useState(false)
  const [seerrStatuses, setSeerrStatuses] = useState<
    Record<number, SeerrBatchStatus>
  >({})
  const [canRequestSeerr, setCanRequestSeerr] = useState(false)
  const [avatarImgVisible, setAvatarImgVisible] = useState(false)
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false)
  const [optionsTargetRow, setOptionsTargetRow] = useState<CreditsGapRow | null>(null)
  const [pendingSeerrOpts, setPendingSeerrOpts] = useState<SeerrRequestOptions | null>(null)
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)
  const [seasonModalRow, setSeasonModalRow] = useState<CreditsGapRow | null>(null)
  const [seasonModalData, setSeasonModalData] = useState<{
    seasons: SeasonInfo[]
    title: string
    posterPath?: string
  } | null>(null)
  const [seasonModalLoading, setSeasonModalLoading] = useState(false)
  const [tmdbDetailOpen, setTmdbDetailOpen] = useState(false)
  const [tmdbDetailLoading, setTmdbDetailLoading] = useState(false)
  const [tmdbDetailError, setTmdbDetailError] = useState<string | null>(null)
  const [tmdbDetailData, setTmdbDetailData] = useState<TmdbExternalDetailPayload | null>(null)
  const [tmdbDetailCreditsRow, setTmdbDetailCreditsRow] = useState<CreditsGapRow | null>(null)
  const [creditsMediaFilter, setCreditsMediaFilter] = useState<'all' | 'movie' | 'tv'>('all')
  const [creditsRoleFilter, setCreditsRoleFilter] = useState<string>('actor')

  const { submitRequest, fetchTVDetails, isRequesting } = useSeerrRequest()

  useEffect(() => {
    const fetchPerson = async () => {
      if (!name) return

      try {
        setLoading(true)
        setError(null)
        setAvatarPhase('media')
        const response = await fetch(`/api/discover/person/${encodeURIComponent(name)}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to load person data')
        }

        const result = await response.json()
        console.info('[peoplePortrait] person detail loaded', {
          name: result.name,
          hasMediaImageUrl: !!result.imageUrl,
          tmdbFallbackImageUrl: result.tmdbFallbackImageUrl
            ? `${String(result.tmdbFallbackImageUrl).slice(0, 56)}…`
            : result.tmdbFallbackImageUrl,
        })
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchPerson()
  }, [name])

  useEffect(() => {
    if (!name) return
    setCreditsGapLoading(true)
    void fetch(`/api/discover/person/${encodeURIComponent(name)}/credits-gap`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((g: CreditsGapResponse | null) => {
        setCreditsGap(g)
        const flatMissing = g?.missing.flatMap((gr) => gr.rows) ?? []
        if (g?.tmdbPersonId != null && flatMissing.length > 0) {
          const items = flatMissing.map((m) => ({
            tmdbId: m.tmdbId,
            mediaType: (m.mediaType === 'movie' ? 'movie' : 'series') as 'movie' | 'series',
          }))
          void fetch('/api/seerr/status/batch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          })
            .then((r) => r.json())
            .then((d: { statuses?: Record<number, SeerrBatchStatus> }) => {
              if (d?.statuses) setSeerrStatuses(d.statuses)
            })
            .catch(() => {})

          const probe = flatMissing[0]
          const mt = probe.mediaType === 'movie' ? 'movie' : 'tv'
          void fetch(`/api/seerr/status/${mt}/${probe.tmdbId}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d: { canRequest?: boolean }) => setCanRequestSeerr(d.canRequest === true))
            .catch(() => setCanRequestSeerr(false))
        }
      })
      .finally(() => setCreditsGapLoading(false))
  }, [name])

  useEffect(() => {
    setCreditsMediaFilter('all')
    setCreditsRoleFilter('actor')
  }, [name])

  const decodedName = useMemo(() => decodeURIComponent(name || ''), [name])

  const proxiedImageUrl = useMemo(() => {
    if (!data?.imageUrl) return null
    return getProxiedImageUrl(data.imageUrl, '')
  }, [data?.imageUrl])

  const proxiedTmdbFallback = useMemo(() => {
    if (!data?.tmdbFallbackImageUrl) return null
    return getProxiedImageUrl(data.tmdbFallbackImageUrl, '')
  }, [data?.tmdbFallbackImageUrl])

  const avatarSrc = useMemo(() => {
    if (!data) return undefined
    if (avatarPhase === 'media') return proxiedImageUrl ?? undefined
    if (avatarPhase === 'tmdb') return proxiedTmdbFallback ?? undefined
    return undefined
  }, [data, avatarPhase, proxiedImageUrl, proxiedTmdbFallback])

  useEffect(() => {
    setAvatarImgVisible(false)
  }, [avatarSrc])

  // Collect backdrop URLs from movies and series (must be before early returns)
  const backdropUrls = useMemo(() => {
    if (!data) return []
    const movieBackdrops = data.movies.map(m => m.backdropUrl)
    const seriesBackdrops = data.series.map(s => s.backdropUrl)
    return [...movieBackdrops, ...seriesBackdrops]
  }, [data])

  const creditsMissingGroupsFiltered = useMemo(() => {
    if (!creditsGap?.missing) return []
    return creditsGap.missing
      .map((group) => {
        if (group.rows.length === 0) return null
        const [media, role] = group.groupKey.split(':')
        if (creditsMediaFilter !== 'all' && media !== creditsMediaFilter) return null
        if (creditsRoleFilter !== 'all' && role !== creditsRoleFilter) return null
        return group
      })
      .filter((g): g is CreditsGapGroup => g != null)
  }, [creditsGap?.missing, creditsMediaFilter, creditsRoleFilter])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Person not found'}</Alert>
      </Box>
    )
  }

  const handleAvatarError = () => {
    if (avatarPhase === 'media' && proxiedTmdbFallback) {
      console.info('[peoplePortrait] header: media image error, switching to TMDb fallback', {
        decodedName,
        hasTmdbFallback: true,
      })
      setAvatarPhase('tmdb')
    } else {
      console.info('[peoplePortrait] header: showing initials', {
        decodedName,
        avatarPhase,
        hadTmdbFallback: !!proxiedTmdbFallback,
      })
      setAvatarPhase('initials')
    }
  }

  const markCreditsRowRequested = (tmdbId: number) => {
    setSeerrStatuses((prev) => ({
      ...prev,
      [tmdbId]: {
        ...(prev[tmdbId] ?? {
          exists: false,
          status: 'unknown',
          requested: false,
        }),
        requested: true,
        requestStatus: 'pending',
      },
    }))
  }

  const handleCreditsRequest = (row: CreditsGapRow) => {
    setOptionsTargetRow(row)
    setOptionsDialogOpen(true)
  }

  const handleSeerrOptionsConfirm = async (opts: SeerrRequestOptions) => {
    const row = optionsTargetRow
    setOptionsDialogOpen(false)
    setOptionsTargetRow(null)
    if (!row) return
    if (row.mediaType === 'tv') {
      setPendingSeerrOpts(opts)
      setSeasonModalLoading(true)
      setSeasonModalRow(row)
      setSeasonModalOpen(true)
      const details = await fetchTVDetails(row.tmdbId)
      setSeasonModalData(details)
      setSeasonModalLoading(false)
    } else {
      const result = await submitRequest(row.tmdbId, 'movie', row.title, undefined, undefined, opts)
      if (result.success) markCreditsRowRequested(row.tmdbId)
    }
  }

  const handleCreditsSeasonSubmit = async (seasons: number[]) => {
    if (!seasonModalRow) return
    const result = await submitRequest(
      seasonModalRow.tmdbId,
      'series',
      seasonModalRow.title,
      undefined,
      seasons,
      pendingSeerrOpts ?? undefined
    )
    if (result.success) markCreditsRowRequested(seasonModalRow.tmdbId)
    setSeasonModalOpen(false)
    setSeasonModalRow(null)
    setSeasonModalData(null)
    setPendingSeerrOpts(null)
  }

  const openTmdbDetailModal = (row: CreditsGapRow) => {
    if (seasonModalOpen) return
    setTmdbDetailCreditsRow(row)
    setTmdbDetailOpen(true)
    setTmdbDetailLoading(true)
    setTmdbDetailError(null)
    setTmdbDetailData(null)
    const path = row.mediaType === 'movie' ? 'movie' : 'tv'
    void fetch(`/api/discover/tmdb/${path}/${row.tmdbId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || 'Failed to load details')
        }
        return r.json() as Promise<TmdbExternalDetailPayload>
      })
      .then(async (payload) => {
        const backdropUrl = payload.backdropPath
          ? `${TMDB_IMG_BASE}/w1280${payload.backdropPath}`
          : null
        const posterUrl = payload.posterPath
          ? `${TMDB_IMG_BASE}/w780${payload.posterPath}`
          : null
        if (backdropUrl) {
          await preloadImage(backdropUrl)
        } else if (posterUrl) {
          await preloadImage(posterUrl)
        }
        setTmdbDetailData(payload)
      })
      .catch((e: unknown) => {
        setTmdbDetailError(e instanceof Error ? e.message : 'Failed to load details')
      })
      .finally(() => {
        setTmdbDetailLoading(false)
      })
  }

  const closeTmdbDetailModal = () => {
    setTmdbDetailOpen(false)
    setTmdbDetailError(null)
    setTmdbDetailData(null)
    setTmdbDetailCreditsRow(null)
  }

  const renderCreditsMissingItem = (row: CreditsGapRow) => {
    const st = seerrStatuses[row.tmdbId]
    const available = st?.status === 'available' || st?.exists === true
    const pending = st?.requested === true || st?.requestStatus === 'pending'
    const showRequest = canRequestSeerr && !available && !pending
    const posterUrl = row.posterUrl ? getProxiedImageUrl(row.posterUrl, '') : null

    return (
      <CarouselItem key={`${row.groupKey}-${row.mediaType}-${row.tmdbId}`}>
        <Box sx={{ width: 160, position: 'relative' }}>
          <MediaPosterCard
            tmdbId={row.tmdbId}
            title={row.title}
            year={row.year}
            posterUrl={posterUrl}
            mediaType={row.mediaType === 'movie' ? 'movie' : 'series'}
            inLibrary={false}
            seerrStatus={
              st
                ? {
                    requested: st.requested,
                    requestStatus: st.requestStatus as
                      | 'pending'
                      | 'approved'
                      | 'declined'
                      | 'unknown'
                      | undefined,
                  }
                : undefined
            }
            canRequest={showRequest}
            isRequesting={isRequesting(row.tmdbId)}
            onRequest={() => void handleCreditsRequest(row)}
            sourceLabel="Credits"
            sourceColor="#01b4e4"
            onClick={() => {
              if (!seasonModalOpen) openTmdbDetailModal(row)
            }}
            compactMeta
          />
        </Box>
      </CarouselItem>
    )
  }

  const tmdbDetailSt = tmdbDetailCreditsRow
    ? seerrStatuses[tmdbDetailCreditsRow.tmdbId]
    : undefined
  const tmdbDetailSeerrAvailable =
    tmdbDetailSt?.status === 'available' || tmdbDetailSt?.exists === true
  const tmdbDetailSeerrPending =
    tmdbDetailSt?.requested === true || tmdbDetailSt?.requestStatus === 'pending'
  const tmdbDetailCanRequest =
    !!tmdbDetailCreditsRow &&
    canRequestSeerr &&
    !tmdbDetailSeerrAvailable &&
    !tmdbDetailSeerrPending

  return (
    <Box>
      {/* Header with rotating backdrop */}
      <Box
        sx={{
          position: 'relative',
          mx: -3,
          mt: -3,
          px: 3,
          pt: 3,
          pb: 4,
          minHeight: 200,
        }}
      >
        {/* Rotating fanart backdrop */}
        <RotatingBackdrop backdropUrls={backdropUrls} height={280} />

        {/* Content overlay */}
        <Box sx={{ position: 'relative', zIndex: 2 }}>
          {/* Back button */}
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              mb: 2,
              bgcolor: 'rgba(0,0,0,0.4)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          <Box display="flex" alignItems="center" gap={3}>
            {/* Person Avatar */}
            <Avatar
              src={avatarSrc ?? undefined}
              onError={handleAvatarError}
              slotProps={{
                img: {
                  onLoad: () => setAvatarImgVisible(true),
                  style: {
                    opacity: avatarSrc ? (avatarImgVisible ? 1 : 0) : 1,
                    transition: 'opacity 0.2s ease',
                  },
                },
              }}
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'primary.dark',
                fontSize: '2.5rem',
                border: '4px solid',
                borderColor: 'primary.main',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              {decodedName.charAt(0)}
            </Avatar>

            {/* Person Info */}
            <Box flex={1}>
              <Typography 
                variant="h4" 
                fontWeight={700} 
                mb={1}
                sx={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {decodedName}
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1}>
                {data.stats.asActor > 0 && (
                  <Chip
                    icon={<PersonIcon />}
                    label={`${data.stats.asActor} as Actor`}
                    size="small"
                    sx={{ bgcolor: 'rgba(99, 102, 241, 0.6)', backdropFilter: 'blur(4px)' }}
                  />
                )}
                {data.stats.asDirector > 0 && (
                  <Chip
                    icon={<VideocamIcon />}
                    label={`${data.stats.asDirector} as Director`}
                    size="small"
                    sx={{ bgcolor: 'rgba(139, 92, 246, 0.6)', backdropFilter: 'blur(4px)' }}
                  />
                )}
                <Chip
                  icon={<MovieIcon />}
                  label={`${data.stats.totalMovies} Movies`}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                />
                <Chip
                  icon={<TvIcon />}
                  label={`${data.stats.totalSeries} Series`}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ px: 3, py: 4 }}>
        {/* Movies Carousel */}
        {data.movies.length > 0 && (
          <Box mb={4}>
            <BaseCarousel
              title="Movies"
              subtitle={`${data.movies.length} movies featuring ${decodedName}`}
              hasItems={data.movies.length > 0}
            >
              {data.movies.map((movie) => (
                <CarouselItem key={movie.id}>
                  <MoviePoster
                    title={movie.title}
                    year={movie.year}
                    posterUrl={movie.posterUrl}
                    rating={movie.communityRating}
                    genres={movie.genres}
                    userRating={getRating('movie', movie.id)}
                    onRate={(rating) => setRating('movie', movie.id, rating)}
                    onClick={() => navigate(`/movies/${movie.id}`)}
                    size="medium"
                  />
                </CarouselItem>
              ))}
            </BaseCarousel>
          </Box>
        )}

        {/* Series Carousel */}
        {data.series.length > 0 && (
          <Box mb={4}>
            <BaseCarousel
              title="TV Series"
              subtitle={`${data.series.length} series featuring ${decodedName}`}
              hasItems={data.series.length > 0}
            >
              {data.series.map((series) => (
                <CarouselItem key={series.id}>
                  <MoviePoster
                    title={series.title}
                    year={series.year}
                    posterUrl={series.posterUrl}
                    rating={series.communityRating}
                    genres={series.genres}
                    userRating={getRating('series', series.id)}
                    onRate={(rating) => setRating('series', series.id, rating)}
                    isWatching={isWatching(series.id)}
                    onWatchingToggle={() => toggleWatching(series.id)}
                    onClick={() => navigate(`/series/${series.id}`)}
                    size="medium"
                  />
                </CarouselItem>
              ))}
            </BaseCarousel>
          </Box>
        )}

        {creditsGapLoading && (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!creditsGapLoading &&
          creditsGap?.tmdbPersonId != null &&
          creditsGap.missing.some((g) => g.rows.length > 0) && (
            <Box mb={4}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Not in your library
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                TMDb credits not matched to your visible library (up to 80 titles). Grouped by
                medium and role; the same title can appear more than once if credits differ (e.g.
                actor and producer).
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={2} alignItems="center" sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="credits-media-filter-label">Media</InputLabel>
                  <Select
                    labelId="credits-media-filter-label"
                    label="Media"
                    value={creditsMediaFilter}
                    onChange={(e) =>
                      setCreditsMediaFilter(e.target.value as 'all' | 'movie' | 'tv')
                    }
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="movie">Movies</MenuItem>
                    <MenuItem value="tv">TV</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="credits-role-filter-label">Role</InputLabel>
                  <Select
                    labelId="credits-role-filter-label"
                    label="Role"
                    value={creditsRoleFilter}
                    onChange={(e) => setCreditsRoleFilter(e.target.value)}
                  >
                    <MenuItem value="all">All roles</MenuItem>
                    <MenuItem value="actor">Acting</MenuItem>
                    <MenuItem value="director">Director</MenuItem>
                    <MenuItem value="producer">Producer</MenuItem>
                    <MenuItem value="writer">Writer</MenuItem>
                    <MenuItem value="creator">Creator</MenuItem>
                    <MenuItem value="other">Other crew</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {creditsMissingGroupsFiltered.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No credits match the current filters.
                </Alert>
              )}

              {creditsMissingGroupsFiltered.map((group) => (
                <Box key={group.groupKey} mb={4}>
                  <BaseCarousel
                    title={group.label}
                    subtitle={`${group.rows.length} not in your library`}
                    hasItems={group.rows.length > 0}
                  >
                    {group.rows.map(renderCreditsMissingItem)}
                  </BaseCarousel>
                </Box>
              ))}

              <RequestSeerrOptionsDialog
                open={optionsDialogOpen}
                mediaType={optionsTargetRow?.mediaType === 'tv' ? 'series' : 'movie'}
                title={optionsTargetRow?.title ?? ''}
                onClose={() => {
                  setOptionsDialogOpen(false)
                  setOptionsTargetRow(null)
                }}
                onConfirm={handleSeerrOptionsConfirm}
              />

              <SeasonSelectModal
                open={seasonModalOpen}
                onClose={() => {
                  setSeasonModalOpen(false)
                  setSeasonModalRow(null)
                  setSeasonModalData(null)
                  setPendingSeerrOpts(null)
                }}
                onSubmit={handleCreditsSeasonSubmit}
                title={seasonModalData?.title || seasonModalRow?.title || ''}
                posterPath={seasonModalData?.posterPath}
                seasons={seasonModalData?.seasons || []}
                loading={seasonModalLoading}
              />
            </Box>
          )}

        {/* Empty state */}
        {data.movies.length === 0 && data.series.length === 0 && (
          <Alert severity="info">
            No content found for {decodedName} in your library.
          </Alert>
        )}

        <TmdbExternalDetailModal
          open={tmdbDetailOpen}
          onClose={closeTmdbDetailModal}
          loading={tmdbDetailLoading}
          error={tmdbDetailError}
          data={tmdbDetailData}
          sourceLabel="TMDb credits"
          canRequest={tmdbDetailCanRequest}
          isRequesting={
            tmdbDetailCreditsRow ? isRequesting(tmdbDetailCreditsRow.tmdbId) : false
          }
          seerrAvailable={tmdbDetailSeerrAvailable}
          seerrPending={tmdbDetailSeerrPending}
          onRequest={
            tmdbDetailCreditsRow
              ? () => void handleCreditsRequest(tmdbDetailCreditsRow)
              : undefined
          }
        />
      </Box>
    </Box>
  )
}

