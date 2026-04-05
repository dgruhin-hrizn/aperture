/**
 * In-app detail modal for TMDb-only titles (e.g. person credits not in library).
 * Data is loaded from GET /api/discover/tmdb/movie/:id or .../tv/:id.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react'
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
  CircularProgress,
  Alert,
  Button,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import StarIcon from '@mui/icons-material/Star'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PersonIcon from '@mui/icons-material/Person'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import TranslateIcon from '@mui/icons-material/Translate'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddIcon from '@mui/icons-material/Add'
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProxiedImageUrl, TrailerModal } from '@aperture/ui'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export interface TmdbExternalDetailPayload {
  mediaType: 'movie' | 'series'
  tmdbId: number
  imdbId: string | null
  title: string
  originalTitle: string | null
  tagline: string | null
  overview: string | null
  posterPath: string | null
  backdropPath: string | null
  releaseYear: number | null
  runtimeMinutes: number | null
  voteAverage: number | null
  voteCount: number | null
  genres: { id: number; name: string }[]
  directors: string[]
  creators: string[]
  castMembers: {
    id: number
    name: string
    character: string
    profilePath: string | null
  }[]
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
  status: string | null
}

interface TmdbExternalDetailModalProps {
  open: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  data: TmdbExternalDetailPayload | null
  /** Shown in meta row, e.g. "Credits" */
  sourceLabel?: string
  /** Seerr request (person credits flow) */
  canRequest?: boolean
  isRequesting?: boolean
  seerrAvailable?: boolean
  seerrPending?: boolean
  onRequest?: () => void
}

export function TmdbExternalDetailModal({
  open,
  onClose,
  loading,
  error,
  data,
  sourceLabel,
  canRequest = false,
  isRequesting = false,
  seerrAvailable = false,
  seerrPending = false,
  onRequest,
}: TmdbExternalDetailModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const displaySourceLabel = sourceLabel ?? t('tmdbExternalModal.defaultSource')
  const [heroImageVisible, setHeroImageVisible] = useState(false)
  const [trailerLoading, setTrailerLoading] = useState(false)
  const [trailerModal, setTrailerModal] = useState<{
    open: boolean
    watchUrl: string | null
    title: string | null
  }>({ open: false, watchUrl: null, title: null })

  const handleOpenTrailer = useCallback(async () => {
    if (!data) return
    const path =
      data.mediaType === 'movie'
        ? `/api/discover/tmdb/movie/${data.tmdbId}/trailer`
        : `/api/discover/tmdb/tv/${data.tmdbId}/trailer`
    setTrailerLoading(true)
    try {
      const res = await fetch(path, { credentials: 'include' })
      const json = (await res.json()) as { trailerUrl?: string | null; name?: string | null }
      if (json.trailerUrl) {
        setTrailerModal({
          open: true,
          watchUrl: json.trailerUrl,
          title: json.name ?? data.title,
        })
      }
    } finally {
      setTrailerLoading(false)
    }
  }, [data])

  const heroImageUrl = useMemo(() => {
    if (data?.backdropPath) return `${TMDB_IMAGE_BASE}/w1280${data.backdropPath}`
    if (data?.posterPath) return `${TMDB_IMAGE_BASE}/w780${data.posterPath}`
    return null
  }, [data?.backdropPath, data?.posterPath])

  useEffect(() => {
    if (!open || !heroImageUrl) {
      setHeroImageVisible(false)
      return
    }
    setHeroImageVisible(false)
    const t = window.setTimeout(() => setHeroImageVisible(true), 50)
    return () => clearTimeout(t)
  }, [open, heroImageUrl])

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0
      ? t('tmdbExternalModal.runtimeHours', { hours, mins })
      : t('tmdbExternalModal.runtimeMins', { mins })
  }

  const handlePersonClick = (name: string) => {
    onClose()
    navigate(`/person/${encodeURIComponent(name)}`)
  }

  const tmdbUrl =
    data?.mediaType === 'movie'
      ? `https://www.themoviedb.org/movie/${data.tmdbId}`
      : data
        ? `https://www.themoviedb.org/tv/${data.tmdbId}`
        : ''

  const imdbUrl = data?.imdbId ? `https://www.imdb.com/title/${data.imdbId}` : null

  const cardStyle = {
    backgroundColor: alpha('#000', 0.35),
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: 2,
    p: { xs: 2, md: 3 },
    height: { xs: 'auto', md: '100%' },
  }

  const directorOrCreatorList =
    data?.mediaType === 'movie' ? data.directors : data?.creators ?? []

  return (
    <>
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
          maxHeight: { xs: '90vh', md: '85vh' },
          overflow: 'auto',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 'auto', md: 500 },
          bgcolor: '#000',
        }}
      >
        {heroImageUrl && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${heroImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: heroImageVisible ? 1 : 0,
              transition: 'opacity 0.55s ease-out',
              zIndex: 0,
            }}
          />
        )}
        {heroImageUrl && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
              opacity: heroImageVisible ? 1 : 0,
              transition: 'opacity 0.55s ease-out',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}
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
            zIndex: 3,
            backgroundColor: alpha('#000', 0.5),
            color: 'white',
            '&:hover': { backgroundColor: alpha('#000', 0.7) },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ position: 'relative', zIndex: 2, py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={280}>
              <CircularProgress />
            </Box>
          )}

          {!loading && error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && data && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={cardStyle}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      icon={
                        data.mediaType === 'movie' ? (
                          <MovieIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <TvIcon sx={{ fontSize: 16 }} />
                        )
                      }
                      label={
                        data.mediaType === 'movie'
                          ? t('tmdbExternalModal.typeMovie')
                          : t('tmdbExternalModal.typeSeries')
                      }
                      size="small"
                      sx={{
                        bgcolor: alpha('#8B5CF6', 0.2),
                        '& .MuiChip-icon': { color: 'inherit' },
                      }}
                    />
                  </Box>

                  <Typography variant="h4" fontWeight={700} gutterBottom>
                    {data.title}
                  </Typography>

                  {data.originalTitle && data.originalTitle !== data.title && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TranslateIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {data.originalTitle}
                      </Typography>
                    </Box>
                  )}

                  {data.tagline && (
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic', mb: 2 }}
                    >
                      &ldquo;{data.tagline}&rdquo;
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    {data.releaseYear != null && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2">{data.releaseYear}</Typography>
                      </Box>
                    )}
                    {data.mediaType === 'series' && data.numberOfSeasons != null && (
                      <Typography variant="body2" color="text.secondary">
                        {t('tmdbExternalModal.season', { count: data.numberOfSeasons })}
                        {data.numberOfEpisodes != null
                          ? ` · ${t('tmdbExternalModal.episodes', { count: data.numberOfEpisodes })}`
                          : ''}
                      </Typography>
                    )}
                    {data.mediaType === 'series' && data.status && (
                      <Chip label={data.status} size="small" variant="outlined" />
                    )}
                    {formatRuntime(data.runtimeMinutes) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2">{formatRuntime(data.runtimeMinutes)}</Typography>
                      </Box>
                    )}
                    {data.voteAverage != null && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                        <Typography variant="body2" fontWeight={600}>
                          {data.voteAverage.toFixed(1)}
                        </Typography>
                      </Box>
                    )}
                    {data.voteCount != null && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <HowToVoteIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {t('tmdbExternalModal.votes', { count: data.voteCount })}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {data.genres.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      {data.genres
                        .filter((g) => g.name)
                        .slice(0, 5)
                        .map((genre) => (
                          <Chip
                            key={genre.id}
                            label={genre.name}
                            size="small"
                            sx={{
                              bgcolor: alpha('#fff', 0.1),
                              '&:hover': { bgcolor: alpha('#fff', 0.15) },
                            }}
                          />
                        ))}
                    </Box>
                  )}

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('tmdbExternalModal.source', { label: displaySourceLabel })}
                  </Typography>

                  {data.overview && (
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
                      {data.overview}
                    </Typography>
                  )}

                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      mt: 2,
                      alignItems: 'center',
                    }}
                  >
                    <Tooltip title={t('tmdbExternalModal.trailerTooltip')}>
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
                          {t('tmdbExternalModal.trailer')}
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      startIcon={<OpenInNewIcon />}
                      href={tmdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('tmdbExternalModal.openOnTmdb')}
                    </Button>
                    {imdbUrl && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<OpenInNewIcon />}
                        href={imdbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('tmdbExternalModal.imdb')}
                      </Button>
                    )}
                    {seerrAvailable && (
                      <Chip
                        size="small"
                        label={t('tmdbExternalModal.inSeerr')}
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {seerrPending && (
                      <Chip size="small" label={t('tmdbExternalModal.requested')} color="warning" variant="outlined" />
                    )}
                    {canRequest && onRequest && (
                      <Button
                        size="medium"
                        variant="contained"
                        color="primary"
                        startIcon={
                          isRequesting ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <AddIcon />
                          )
                        }
                        disabled={isRequesting}
                        onClick={(e) => {
                          e.stopPropagation()
                          onRequest()
                        }}
                      >
                        {isRequesting ? t('tmdbExternalModal.requesting') : t('tmdbExternalModal.request')}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={cardStyle}>
                  {directorOrCreatorList.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <MovieIcon fontSize="small" />
                        {data.mediaType === 'movie'
                          ? t('tmdbExternalModal.director')
                          : t('tmdbExternalModal.createdBy')}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {directorOrCreatorList.map((name) => (
                          <Chip
                            key={name}
                            label={name}
                            size="small"
                            onClick={() => handlePersonClick(name)}
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

                  {data.castMembers.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PersonIcon fontSize="small" />
                        {t('tmdbExternalModal.cast')}
                      </Typography>
                      <Grid container spacing={1}>
                        {data.castMembers.slice(0, 8).map((cast) => (
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
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  noWrap
                                  sx={{ fontSize: '0.8rem' }}
                                >
                                  {cast.name}
                                </Typography>
                                {cast.character && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                    sx={{ fontSize: '0.7rem' }}
                                  >
                                    {t('tmdbExternalModal.castAs', { character: cast.character })}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {data.castMembers.length === 0 && directorOrCreatorList.length === 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 200,
                        color: 'text.secondary',
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                      <Typography variant="body2">{t('tmdbExternalModal.castUnavailable')}</Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
      </Box>
    </Dialog>
    <TrailerModal
      open={trailerModal.open}
      onClose={() => setTrailerModal({ open: false, watchUrl: null, title: null })}
      watchUrl={trailerModal.watchUrl}
      title={trailerModal.title}
    />
    </>
  )
}
