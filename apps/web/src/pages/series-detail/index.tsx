import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, CircularProgress, Grid } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'
import { useWatching } from '../../hooks/useWatching'
import { useSeriesDetail } from './hooks'
import {
  SeriesBackdrop,
  SeriesHero,
  SeriesInfoCard,
  SeasonsList,
  SimilarSeries,
} from './components'

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isWatching, toggleWatching } = useWatching()

  const {
    series,
    seasons,
    similar,
    mediaServer,
    userRating,
    loading,
    error,
    handleRate,
  } = useSeriesDetail(id, user?.id)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !series) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error" variant="h6">
          {error || 'Series not found'}
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Backdrop */}
      <SeriesBackdrop
        backdropUrl={series.backdrop_url}
        title={series.title}
        onBack={() => navigate(-1)}
      />

      {/* Hero Section */}
      <SeriesHero
        series={series}
        mediaServer={mediaServer}
        userRating={userRating}
        onRate={handleRate}
        isWatching={id ? isWatching(id) : false}
        onWatchingToggle={id ? () => toggleWatching(id) : undefined}
      />

      {/* Main Content */}
      <Box sx={{ mt: 4, px: 3 }}>
        <Grid container spacing={3}>
          {/* Left Column - Info */}
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <SeriesInfoCard series={series} />
              <SeasonsList seasons={seasons} />
            </Box>
          </Grid>

          {/* Right Column - Similar */}
          <Grid item xs={12} md={4}>
            <SimilarSeries similar={similar} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}


