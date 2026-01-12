import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BusinessIcon from '@mui/icons-material/Business'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { MoviePoster, BaseCarousel, CarouselItem, getProxiedImageUrl } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'

interface ContentItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  communityRating: number | null
}

interface StudioData {
  name: string
  imageUrl: string | null
  movies: ContentItem[]
  series: ContentItem[]
  stats: {
    totalMovies: number
    totalSeries: number
  }
}

export function StudioDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [data, setData] = useState<StudioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const fetchStudio = async () => {
      if (!name) return

      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/discover/studio/${encodeURIComponent(name)}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to load studio data')
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStudio()
  }, [name])

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
        <Alert severity="error">{error || 'Studio not found'}</Alert>
      </Box>
    )
  }

  const decodedName = decodeURIComponent(name || '')
  const proxiedImageUrl = data.imageUrl ? getProxiedImageUrl(data.imageUrl, '') : null

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
          mx: -3,
          mt: -3,
          px: 3,
          pt: 3,
          pb: 4,
        }}
      >
        {/* Back button */}
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            mb: 2,
            bgcolor: 'rgba(0,0,0,0.3)',
            color: 'white',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Box display="flex" alignItems="center" gap={3}>
          {/* Studio Logo */}
          <Avatar
            src={proxiedImageUrl && !imageError ? proxiedImageUrl : undefined}
            onError={() => setImageError(true)}
            variant="rounded"
            sx={{
              width: 120,
              height: 120,
              bgcolor: '#f97316',
              fontSize: '1.5rem',
              border: '4px solid',
              borderColor: '#f97316',
            }}
          >
            {decodedName.substring(0, 2).toUpperCase()}
          </Avatar>

          {/* Studio Info */}
          <Box flex={1}>
            <Typography variant="h4" fontWeight={700} mb={1}>
              {decodedName}
            </Typography>

            <Box display="flex" flexWrap="wrap" gap={1}>
              <Chip
                icon={<MovieIcon />}
                label={`${data.stats.totalMovies} Movies`}
                size="small"
                sx={{ bgcolor: 'rgba(249, 115, 22, 0.2)' }}
              />
              <Chip
                icon={<TvIcon />}
                label={`${data.stats.totalSeries} Series`}
                size="small"
                sx={{ bgcolor: 'rgba(6, 182, 212, 0.2)' }}
              />
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
              subtitle={`${data.movies.length} movies from ${decodedName}`}
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
              subtitle={`${data.series.length} series from ${decodedName}`}
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
                    onClick={() => navigate(`/series/${series.id}`)}
                    size="medium"
                  />
                </CarouselItem>
              ))}
            </BaseCarousel>
          </Box>
        )}

        {/* Empty state */}
        {data.movies.length === 0 && data.series.length === 0 && (
          <Alert severity="info">
            No content found for {decodedName} in your library.
          </Alert>
        )}
      </Box>
    </Box>
  )
}

