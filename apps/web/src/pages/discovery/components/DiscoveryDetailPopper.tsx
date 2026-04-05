/**
 * Discovery Detail Popper
 * 
 * Modal dialog showing detailed metadata for a discovery candidate
 * with a fanart backdrop and 2-column card layout
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Grid,
  alpha,
  Button,
  CircularProgress,
  Tooltip,
  Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import StarIcon from '@mui/icons-material/Star'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PersonIcon from '@mui/icons-material/Person'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import SourceIcon from '@mui/icons-material/Source'
import TranslateIcon from '@mui/icons-material/Translate'
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo'
import { useNavigate } from 'react-router-dom'
import { getProxiedImageUrl, TrailerModal } from '@aperture/ui'
import type { DiscoveryCandidate } from '../types'
import type { ResolveDiscoveryGenreName } from '../hooks'
import { discoverySourceLabel } from '../discoveryLabels'
import type { TmdbExternalDetailPayload } from '../../../components/TmdbExternalDetailModal'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const FALLBACK_BACKDROP = '/NO_POSTER_FOUND.png'

function mergeDiscoveryWithTmdb(
  base: DiscoveryCandidate,
  tmdb: TmdbExternalDetailPayload | null
): DiscoveryCandidate {
  if (!tmdb) return base
  const directorsForDisplay =
    tmdb.mediaType === 'movie'
      ? tmdb.directors.length > 0
        ? tmdb.directors
        : base.directors
      : tmdb.creators.length > 0
        ? tmdb.creators
        : base.directors
  return {
    ...base,
    title: tmdb.title,
    originalTitle: tmdb.originalTitle ?? base.originalTitle,
    tagline: tmdb.tagline ?? base.tagline,
    overview: tmdb.overview ?? base.overview,
    posterPath: tmdb.posterPath ?? base.posterPath,
    backdropPath: tmdb.backdropPath ?? base.backdropPath,
    releaseYear: tmdb.releaseYear ?? base.releaseYear,
    runtimeMinutes: tmdb.runtimeMinutes ?? base.runtimeMinutes,
    voteAverage: tmdb.voteAverage ?? base.voteAverage,
    voteCount: tmdb.voteCount ?? base.voteCount,
    genres: tmdb.genres.length > 0 ? tmdb.genres : base.genres,
    directors: directorsForDisplay,
    castMembers: tmdb.castMembers.length > 0 ? tmdb.castMembers : base.castMembers,
    imdbId: tmdb.imdbId ?? base.imdbId,
    isEnriched: true,
  }
}

interface DiscoveryDetailPopperProps {
  candidate: DiscoveryCandidate | null
  open: boolean
  onClose: () => void
  resolveGenreName: ResolveDiscoveryGenreName
}

export function DiscoveryDetailPopper({
  candidate,
  open,
  onClose,
  resolveGenreName,
}: DiscoveryDetailPopperProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [trailerLoading, setTrailerLoading] = useState(false)
  const [trailerModal, setTrailerModal] = useState<{
    open: boolean
    watchUrl: string | null
    title: string | null
  }>({ open: false, watchUrl: null, title: null })
  const [tmdbDetail, setTmdbDetail] = useState<TmdbExternalDetailPayload | null>(null)
  const [tmdbDetailLoading, setTmdbDetailLoading] = useState(false)
  const [tmdbDetailError, setTmdbDetailError] = useState<string | null>(null)

  const streamingNeedsTmdbFetch =
    !!candidate &&
    (candidate.source === 'justwatch_streaming' || candidate.source === 'tmdb_genre_row') &&
    candidate.tmdbId > 0

  useEffect(() => {
    if (!open || !candidate) {
      setTmdbDetail(null)
      setTmdbDetailError(null)
      setTmdbDetailLoading(false)
      return
    }
    if (!streamingNeedsTmdbFetch) {
      setTmdbDetail(null)
      setTmdbDetailError(null)
      setTmdbDetailLoading(false)
      return
    }
    let cancelled = false
    setTmdbDetail(null)
    setTmdbDetailError(null)
    setTmdbDetailLoading(true)
    const path =
      candidate.mediaType === 'movie'
        ? `/api/discover/tmdb/movie/${candidate.tmdbId}`
        : `/api/discover/tmdb/tv/${candidate.tmdbId}`
    void fetch(path, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || res.statusText)
        }
        return res.json() as Promise<TmdbExternalDetailPayload>
      })
      .then((data) => {
        if (!cancelled) setTmdbDetail(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setTmdbDetailError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setTmdbDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, candidate?.id, candidate?.tmdbId, candidate?.mediaType, streamingNeedsTmdbFetch])

  const displayCandidate = useMemo(() => {
    if (!candidate) return null
    return mergeDiscoveryWithTmdb(candidate, tmdbDetail)
  }, [candidate, tmdbDetail])

  const hideAiMatchSection =
    candidate?.source === 'justwatch_streaming' || candidate?.source === 'tmdb_genre_row'

  const handleOpenTrailer = useCallback(async () => {
    if (!displayCandidate) return
    const path =
      displayCandidate.mediaType === 'movie'
        ? `/api/discover/tmdb/movie/${displayCandidate.tmdbId}/trailer`
        : `/api/discover/tmdb/tv/${displayCandidate.tmdbId}/trailer`
    setTrailerLoading(true)
    try {
      const res = await fetch(path, { credentials: 'include' })
      const json = (await res.json()) as { trailerUrl?: string | null; name?: string | null }
      if (json.trailerUrl) {
        setTrailerModal({
          open: true,
          watchUrl: json.trailerUrl,
          title: json.name ?? displayCandidate.title,
        })
      }
    } finally {
      setTrailerLoading(false)
    }
  }, [displayCandidate])

  const backdropUrl =
    displayCandidate?.backdropPath != null
      ? `${TMDB_IMAGE_BASE}/w1280${displayCandidate.backdropPath}`
      : FALLBACK_BACKDROP

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? t('discovery.runtimeHm', { hours, mins }) : t('discovery.runtimeM', { mins })
  }

  const handlePersonClick = (name: string) => {
    onClose()
    navigate(`/person/${encodeURIComponent(name)}`)
  }

  // Semi-transparent card style with backdrop blur
  const cardStyle = {
    backgroundColor: alpha('#000', 0.35),
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)', // Safari support
    borderRadius: 2,
    p: { xs: 2, md: 3 },
    height: { xs: 'auto', md: '100%' },
  }

  return (
    <>
    {candidate && displayCandidate ? (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          borderRadius: 2,
          // Allow scrolling on mobile
          maxHeight: { xs: '90vh', md: '85vh' },
          overflow: 'auto',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 'auto', md: 500 },
          backgroundImage: `url(${backdropUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: { xs: 'scroll', md: 'scroll' },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
          },
        }}
      >
        {/* Close button - sticky on mobile for better UX when scrolling */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          sx={{
            position: { xs: 'sticky', md: 'absolute' },
            top: { xs: 8, md: 16 },
            right: { xs: 8, md: 16 },
            float: { xs: 'right', md: 'none' },
            zIndex: 10,
            backgroundColor: alpha('#000', 0.5),
            color: 'white',
            '&:hover': { backgroundColor: alpha('#000', 0.7) },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ position: 'relative', zIndex: 1, py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
          {tmdbDetailError && streamingNeedsTmdbFetch && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {tmdbDetailError}
            </Alert>
          )}
          {streamingNeedsTmdbFetch && tmdbDetailLoading && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                py: 4,
                mb: 2,
              }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                {t('discovery.detail.loadingTmdb')}
              </Typography>
            </Box>
          )}
          <Grid
            container
            spacing={3}
            sx={{
              ...(streamingNeedsTmdbFetch && tmdbDetailLoading && !tmdbDetail
                ? { opacity: 0.35, pointerEvents: 'none' }
                : {}),
            }}
          >
            {/* Left Card - Media Info */}
            <Grid item xs={12} md={6}>
              <Box sx={cardStyle}>
                {/* Media Type Badge */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    icon={displayCandidate.mediaType === 'movie' ? <MovieIcon sx={{ fontSize: 16 }} /> : <TvIcon sx={{ fontSize: 16 }} />}
                    label={
                      displayCandidate.mediaType === 'movie'
                        ? t('discovery.detail.mediaMovie')
                        : t('discovery.detail.mediaSeries')
                    }
                    size="small"
                    sx={{
                      bgcolor: alpha('#8B5CF6', 0.2),
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                </Box>

                {/* Title */}
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  {displayCandidate.title}
                </Typography>

                {/* Original Title (if different) */}
                {displayCandidate.originalTitle && displayCandidate.originalTitle !== displayCandidate.title && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <TranslateIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {displayCandidate.originalTitle}
                    </Typography>
                  </Box>
                )}

                {/* Tagline */}
                {displayCandidate.tagline && (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', mb: 2 }}
                  >
                    "{displayCandidate.tagline}"
                  </Typography>
                )}

                {/* Meta row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  {displayCandidate.releaseYear && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{displayCandidate.releaseYear}</Typography>
                    </Box>
                  )}
                  {displayCandidate.runtimeMinutes && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{formatRuntime(displayCandidate.runtimeMinutes)}</Typography>
                    </Box>
                  )}
                  {displayCandidate.voteAverage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                      <Typography variant="body2" fontWeight={600}>
                        {displayCandidate.voteAverage.toFixed(1)}
                      </Typography>
                    </Box>
                  )}
                  {displayCandidate.voteCount && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <HowToVoteIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {t('discovery.detail.votes', {
                          count: displayCandidate.voteCount.toLocaleString(i18n.language),
                        })}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Genres */}
                {displayCandidate.genres.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {displayCandidate.genres
                      .filter((g) => resolveGenreName(g.id, g.name))
                      .slice(0, 5)
                      .map((genre) => (
                      <Chip
                        key={genre.id}
                        label={resolveGenreName(genre.id, genre.name)}
                        size="small"
                        sx={{
                          bgcolor: alpha('#fff', 0.1),
                          '&:hover': { bgcolor: alpha('#fff', 0.15) },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* Source */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SourceIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {t('discovery.detail.source', {
                        label: discoverySourceLabel(displayCandidate.source, t, 'detail'),
                      })}
                    </Typography>
                  </Box>
                  <Tooltip title={t('discovery.detail.trailerTooltip')}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={
                          trailerLoading ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <OndemandVideoIcon />
                          )
                        }
                        disabled={trailerLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleOpenTrailer()
                        }}
                      >
                        {t('discovery.detail.trailer')}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>

                {/* Overview */}
                {displayCandidate.overview && (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ lineHeight: 1.7, mb: 2 }}
                  >
                    {displayCandidate.overview}
                  </Typography>
                )}

                {/* Match score (AI discovery only; hidden for streaming chart rows) */}
                {!hideAiMatchSection && (
                  <Box sx={{ mt: 'auto', pt: 2, borderTop: 1, borderColor: alpha('#fff', 0.1) }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t('discovery.detail.aiMatchScore')}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="primary.main">
                          {(displayCandidate.finalScore * 100).toFixed(0)}%
                        </Typography>
                      </Grid>
                      {displayCandidate.similarityScore !== null && (
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            {t('discovery.detail.similarity')}
                          </Typography>
                          <Typography variant="h6" fontWeight={600}>
                            {(displayCandidate.similarityScore * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Right Card - Cast & Crew */}
            <Grid item xs={12} md={6}>
              <Box sx={cardStyle}>
                {/* Directors / Creators */}
                {displayCandidate.directors.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <MovieIcon fontSize="small" />
                      {displayCandidate.mediaType === 'movie'
                        ? t('discovery.detail.director')
                        : t('discovery.detail.createdBy')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {displayCandidate.directors.map((director) => (
                        <Chip
                          key={director}
                          label={director}
                          size="small"
                          onClick={() => handlePersonClick(director)}
                          sx={{
                            bgcolor: alpha('#8B5CF6', 0.2),
                            '&:hover': { bgcolor: alpha('#8B5CF6', 0.3) },
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Cast - 2 column layout */}
                {displayCandidate.castMembers.length > 0 && (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <PersonIcon fontSize="small" />
                      {t('discovery.detail.cast')}
                    </Typography>
                    <Grid container spacing={1}>
                      {displayCandidate.castMembers.slice(0, 8).map((cast) => (
                        <Grid item xs={6} key={cast.id}>
                          <Box
                            onClick={() => handlePersonClick(cast.name)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              p: 0.75,
                              borderRadius: 1,
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              '&:hover': {
                                bgcolor: alpha('#fff', 0.05),
                              },
                            }}
                          >
                            <Avatar
                              src={
                                cast.profilePath
                                  ? getProxiedImageUrl(`${TMDB_IMAGE_BASE}/w92${cast.profilePath}`)
                                  : undefined
                              }
                              sx={{ width: 36, height: 36, bgcolor: 'grey.700' }}
                            >
                              <PersonIcon sx={{ fontSize: 16 }} />
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem' }}>
                                {cast.name}
                              </Typography>
                              {cast.character && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                                  {t('discovery.detail.castAs', { character: cast.character })}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Empty state */}
                {displayCandidate.castMembers.length === 0 && displayCandidate.directors.length === 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: 200,
                      color: 'text.secondary',
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2">
                      {t('discovery.detail.castUnavailable')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
      </Box>
    </Dialog>
    ) : null}
    <TrailerModal
      open={trailerModal.open}
      onClose={() => setTrailerModal({ open: false, watchUrl: null, title: null })}
      watchUrl={trailerModal.watchUrl}
      title={trailerModal.title}
    />
    </>
  )
}

