import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, CircularProgress, Grid } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'
import { useWatching } from '../../hooks/useWatching'
import { useMediaDetail } from './hooks'
import {
  MediaBackdrop,
  MediaHero,
  MediaInfoCard,
  SeasonsList,
  SimilarMedia,
  MovieInsights,
} from './components'
import { isMovie, isSeries } from './types'
import type { MediaType } from './types'

interface MediaDetailPageProps {
  mediaType: MediaType
}

export function MediaDetailPage({ mediaType }: MediaDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isWatching, toggleWatching } = useWatching()

  const {
    media,
    similar,
    insights,
    mediaServer,
    watchStatus,
    watchStats,
    userRating,
    ratingLoading,
    loading,
    error,
    seasons,
    clearWatchStatus,
    updateRating,
  } = useMediaDetail(mediaType, id, user?.id)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !media) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error" variant="h6">
          {error || `${mediaType === 'movie' ? 'Movie' : 'Series'} not found`}
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Backdrop */}
      <MediaBackdrop
        backdropUrl={media.backdrop_url}
        title={media.title}
        onBack={() => navigate(-1)}
      />

      {/* Hero Section */}
      <MediaHero
        media={media}
        mediaServer={mediaServer}
        userRating={userRating}
        ratingLoading={ratingLoading}
        onRatingChange={updateRating}
        // Series-specific
        isWatching={isSeries(media) && id ? isWatching(id) : false}
        onWatchingToggle={isSeries(media) && id ? () => toggleWatching(id) : undefined}
        // Movie-specific
        watchStatus={isMovie(media) ? watchStatus : undefined}
        canManageWatchHistory={user?.isAdmin || user?.canManageWatchHistory || false}
        userId={user?.id}
        onMarkedUnwatched={isMovie(media) ? clearWatchStatus : undefined}
      />

      {/* AI Recommendation Insights (Movies only) */}
      {isMovie(media) && insights && <MovieInsights insights={insights} />}

      {/* Main Content */}
      <Box sx={{ mt: 4, px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={3}>
          {/* Left Column - Info */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <MediaInfoCard media={media} watchStats={watchStats} />
              {/* Episodes List (Series only) */}
              {isSeries(media) && Object.keys(seasons).length > 0 && (
                <SeasonsList seasons={seasons} />
              )}
            </Box>
          </Grid>

          {/* Right Column - Similar */}
          <Grid item xs={12} md={6}>
            <SimilarMedia
              mediaType={mediaType}
              mediaId={id}
              mediaTitle={media.title}
              similar={similar}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Bottom padding */}
      <Box sx={{ pb: 4 }} />
    </Box>
  )
}

// Export convenience wrappers for routes
export function MovieDetailPage() {
  return <MediaDetailPage mediaType="movie" />
}

export function SeriesDetailPage() {
  return <MediaDetailPage mediaType="series" />
}

