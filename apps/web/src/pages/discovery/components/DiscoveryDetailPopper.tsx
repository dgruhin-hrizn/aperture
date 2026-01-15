/**
 * Discovery Detail Popper
 * 
 * Modal dialog showing detailed metadata for a discovery candidate
 * with a fanart backdrop and 2-column card layout
 */
import React from 'react'
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
import { useNavigate } from 'react-router-dom'
import { getProxiedImageUrl } from '@aperture/ui'
import type { DiscoveryCandidate } from '../types'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const FALLBACK_BACKDROP = '/NO_POSTER_FOUND.png'

interface DiscoveryDetailPopperProps {
  candidate: DiscoveryCandidate | null
  open: boolean
  onClose: () => void
}

export function DiscoveryDetailPopper({
  candidate,
  open,
  onClose,
}: DiscoveryDetailPopperProps) {
  const navigate = useNavigate()

  if (!candidate) return null

  const backdropUrl = candidate.backdropPath
    ? `${TMDB_IMAGE_BASE}/w1280${candidate.backdropPath}`
    : FALLBACK_BACKDROP

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
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
    p: 3,
    height: '100%',
  }

  // Format source label
  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      tmdb_recommendations: 'TMDb Recommended',
      tmdb_similar: 'Similar Titles',
      tmdb_discover: 'TMDb Discover',
      trakt_trending: 'Trakt Trending',
      trakt_popular: 'Trakt Popular',
      trakt_recommendations: 'Trakt Pick',
      mdblist: 'MDBList',
    }
    return labels[source] || source
  }

  return (
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
          overflow: 'hidden',
          borderRadius: 2,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: 500,
          backgroundImage: `url(${backdropUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
          },
        }}
      >
        {/* Close button */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            backgroundColor: alpha('#000', 0.5),
            color: 'white',
            '&:hover': { backgroundColor: alpha('#000', 0.7) },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ position: 'relative', zIndex: 1, py: 4 }}>
          <Grid container spacing={3}>
            {/* Left Card - Media Info */}
            <Grid item xs={12} md={6}>
              <Box sx={cardStyle}>
                {/* Media Type Badge */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    icon={candidate.mediaType === 'movie' ? <MovieIcon sx={{ fontSize: 16 }} /> : <TvIcon sx={{ fontSize: 16 }} />}
                    label={candidate.mediaType === 'movie' ? 'Movie' : 'TV Series'}
                    size="small"
                    sx={{
                      bgcolor: alpha('#8B5CF6', 0.2),
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                </Box>

                {/* Title */}
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  {candidate.title}
                </Typography>

                {/* Original Title (if different) */}
                {candidate.originalTitle && candidate.originalTitle !== candidate.title && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <TranslateIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {candidate.originalTitle}
                    </Typography>
                  </Box>
                )}

                {/* Tagline */}
                {candidate.tagline && (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', mb: 2 }}
                  >
                    "{candidate.tagline}"
                  </Typography>
                )}

                {/* Meta row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  {candidate.releaseYear && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{candidate.releaseYear}</Typography>
                    </Box>
                  )}
                  {candidate.runtimeMinutes && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">{formatRuntime(candidate.runtimeMinutes)}</Typography>
                    </Box>
                  )}
                  {candidate.voteAverage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                      <Typography variant="body2" fontWeight={600}>
                        {candidate.voteAverage.toFixed(1)}
                      </Typography>
                    </Box>
                  )}
                  {candidate.voteCount && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <HowToVoteIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {candidate.voteCount.toLocaleString()} votes
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Genres */}
                {candidate.genres.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {candidate.genres.filter(g => g.name).slice(0, 5).map((genre) => (
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

                {/* Source */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                  <SourceIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Source: {getSourceLabel(candidate.source)}
                  </Typography>
                </Box>

                {/* Overview */}
                {candidate.overview && (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ lineHeight: 1.7, mb: 2 }}
                  >
                    {candidate.overview}
                  </Typography>
                )}

                {/* Match Score Section */}
                <Box sx={{ mt: 'auto', pt: 2, borderTop: 1, borderColor: alpha('#fff', 0.1) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        AI Match Score
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        {(candidate.finalScore * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                    {candidate.similarityScore !== null && (
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Similarity
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {(candidate.similarityScore * 100).toFixed(0)}%
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </Box>
            </Grid>

            {/* Right Card - Cast & Crew */}
            <Grid item xs={12} md={6}>
              <Box sx={cardStyle}>
                {/* Directors / Creators */}
                {candidate.directors.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <MovieIcon fontSize="small" />
                      {candidate.mediaType === 'movie' ? 'Director' : 'Created By'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {candidate.directors.map((director) => (
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
                {candidate.castMembers.length > 0 && (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <PersonIcon fontSize="small" />
                      Cast
                    </Typography>
                    <Grid container spacing={1}>
                      {candidate.castMembers.slice(0, 8).map((cast) => (
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
                                  as {cast.character}
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
                {candidate.castMembers.length === 0 && candidate.directors.length === 0 && (
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
                      Cast information not available
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
      </Box>
    </Dialog>
  )
}

