import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { MoviePoster, BaseCarousel, CarouselItem, getProxiedImageUrl } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'
import { RotatingBackdrop } from '../components/RotatingBackdrop'

interface ContentItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
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
  const { t } = useTranslation()
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
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
          throw new Error(t('studioDetail.errorLoad'))
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('studioDetail.errorGeneric'))
      } finally {
        setLoading(false)
      }
    }

    fetchStudio()
  }, [name, t])

  // Collect backdrop URLs from movies and series (must be before early returns)
  const backdropUrls = useMemo(() => {
    if (!data) return []
    const movieBackdrops = data.movies.map(m => m.backdropUrl)
    const seriesBackdrops = data.series.map(s => s.backdropUrl)
    return [...movieBackdrops, ...seriesBackdrops]
  }, [data])

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
        <Alert severity="error">{error || t('studioDetail.notFound')}</Alert>
      </Box>
    )
  }

  const decodedName = decodeURIComponent(name || '')
  const proxiedImageUrl = data.imageUrl ? getProxiedImageUrl(data.imageUrl, '') : null

  return (
    <Box>
      {/* Header with rotating backdrop */}
      <Box
        sx={{
          position: 'relative',
          mx: { xs: 'var(--ap-layout-inset)', md: -3 },
          mt: { xs: -1, sm: -2, md: -3 },
          px: { xs: 'var(--ap-page-gutter)', md: 3 },
          pt: { xs: 1.5, sm: 3 },
          pb: { xs: 1.5, sm: 4 },
          minHeight: { xs: 0, sm: 200 },
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
              display: { xs: 'none', md: 'inline-flex' },
              mb: 2,
              bgcolor: 'rgba(0,0,0,0.4)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          <Box display="flex" alignItems="center" gap={{ xs: 1.25, sm: 3 }}>
            {/* Studio Logo */}
            {proxiedImageUrl && !imageError ? (
              <Box
                component="img"
                src={proxiedImageUrl}
                alt={`${decodedName} logo`}
                onError={() => setImageError(true)}
                sx={{
                  height: { xs: 40, sm: 64 },
                  maxWidth: { xs: 76, sm: 180 },
                  objectFit: 'contain',
                  borderRadius: 1,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
                }}
              />
            ) : (
              <Avatar
                variant="rounded"
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: '#f97316',
                  fontSize: '1.25rem',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                {decodedName.substring(0, 2).toUpperCase()}
              </Avatar>
            )}

            {/* Studio Info */}
            <Box flex={1} minWidth={0}>
              <Typography 
                variant="h4" 
                fontWeight={700} 
                mb={1}
                sx={{ fontSize: { xs: '1.3rem', sm: undefined }, overflowWrap: 'anywhere', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {decodedName}
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1}>
                <Chip
                  icon={<MovieIcon />}
                  label={`${data.stats.totalMovies} Movies`}
                  size="small"
                  sx={{ bgcolor: 'rgba(249, 115, 22, 0.6)', backdropFilter: 'blur(4px)' }}
                />
                <Chip
                  icon={<TvIcon />}
                  label={`${data.stats.totalSeries} Series`}
                  size="small"
                  sx={{ bgcolor: 'rgba(6, 182, 212, 0.6)', backdropFilter: 'blur(4px)' }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ px: { xs: 0, sm: 3 }, py: { xs: 1, sm: 4 } }}>
        {/* Movies Carousel */}
        {data.movies.length > 0 && (
          <Box mb={{ xs: 2, sm: 4 }}>
            <BaseCarousel
              title={t('studioDetail.moviesCarousel')}
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
          <Box mb={{ xs: 2, sm: 4 }}>
            <BaseCarousel
              title={t('studioDetail.seriesCarousel')}
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

        {/* Empty state */}
        {data.movies.length === 0 && data.series.length === 0 && (
          <Alert severity="info">
            {t('studioDetail.emptyLibrary', { name: decodedName })}
          </Alert>
        )}
      </Box>
    </Box>
  )
}

