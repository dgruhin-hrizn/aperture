import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, CircularProgress, Grid } from '@mui/material'
import { useAuth } from '../../hooks/useAuth'
import { useMovieDetail } from './hooks'
import {
  MovieBackdrop,
  MovieHero,
  MovieInsights,
  MovieInfoCard,
  SimilarMovies,
} from './components'

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { movie, similar, insights, mediaServer, loading, error } = useMovieDetail(id, user?.id)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !movie) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error" variant="h6">
          {error || 'Movie not found'}
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Backdrop */}
      <MovieBackdrop
        backdropUrl={movie.backdrop_url}
        title={movie.title}
        onBack={() => navigate(-1)}
      />

      {/* Hero Section */}
      <MovieHero movie={movie} mediaServer={mediaServer} />

      {/* Main Content */}
      <Box sx={{ px: 3, mt: 4 }}>
        <Grid container spacing={4}>
          {/* Overview */}
          <Grid item xs={12} md={8}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Overview
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {movie.overview || 'No overview available.'}
            </Typography>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            <MovieInfoCard movie={movie} />
          </Grid>
        </Grid>
      </Box>

      {/* AI Recommendation Insights */}
      {insights && <MovieInsights insights={insights} />}

      {/* Similar Movies */}
      <SimilarMovies similar={similar} />

      {/* Bottom padding */}
      <Box sx={{ pb: 4 }} />
    </Box>
  )
}

