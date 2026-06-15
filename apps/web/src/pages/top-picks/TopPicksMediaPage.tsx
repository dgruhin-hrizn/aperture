import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import TvIcon from '@mui/icons-material/Tv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import PeopleIcon from '@mui/icons-material/People'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { MoviePoster, RankBadge } from '@aperture/ui'
import { useUserRatings } from '../../hooks/useUserRatings'
import { useWatching } from '../../hooks/useWatching'

type TopPicksMediaType = 'movie' | 'series'
type ViewMode = 'grid' | 'list'

interface TopPicksConfig {
  timeWindowDays: number
  moviesCount?: number
  seriesCount?: number
  minUniqueViewers: number
  lastRefreshedAt: string | null
}

interface PopularMovie {
  movieId: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  uniqueViewers: number
  playCount: number
  rank: number
}

interface PopularSeries {
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  uniqueViewers: number
  totalEpisodesWatched: number
  avgCompletionRate: number
  rank: number
}

interface TopPicksMovieResponse {
  movies: PopularMovie[]
  config: TopPicksConfig
}

interface TopPicksSeriesResponse {
  series: PopularSeries[]
  config: TopPicksConfig
}

type TopPickItem =
  | (PopularMovie & { mediaType: 'movie'; id: string })
  | (PopularSeries & { mediaType: 'series'; id: string })

interface TopPicksMediaPageProps {
  mediaType: TopPicksMediaType
}

export function TopPicksMediaPage({ mediaType }: TopPicksMediaPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const [items, setItems] = useState<TopPickItem[]>([])
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const isMovie = mediaType === 'movie'
  const headerIcon = isMovie
    ? <WhatshotIcon sx={{ color: '#f97316', fontSize: 32 }} />
    : <TvIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />

  const handleRate = useCallback(
    async (itemId: string, rating: number | null) => {
      try {
        await setRating(mediaType, itemId, rating)
      } catch (err) {
        console.error(`Failed to rate ${mediaType}:`, err)
      }
    },
    [mediaType, setRating]
  )

  useEffect(() => {
    const fetchTopPicks = async () => {
      try {
        const response = await fetch(`/api/top-picks/${isMovie ? 'movies' : 'series'}`, {
          credentials: 'include',
        })
        if (response.ok) {
          if (isMovie) {
            const data = await response.json() as TopPicksMovieResponse
            setItems(data.movies.map((movie) => ({ ...movie, mediaType: 'movie', id: movie.movieId })))
            setConfig(data.config)
          } else {
            const data = await response.json() as TopPicksSeriesResponse
            setItems(data.series.map((show) => ({ ...show, mediaType: 'series', id: show.seriesId })))
            setConfig(data.config)
          }
          setError(null)
        } else {
          setError(t(isMovie ? 'topPicksPage.errorLoadMovies' : 'topPicksPage.errorLoadSeries'))
        }
      } catch {
        setError(t('topPicksPage.errorConnect'))
      } finally {
        setLoading(false)
      }
    }

    void fetchTopPicks()
  }, [isMovie, t])

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={2}>
          {[...Array(10)].map((_, i) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
              <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4} flexWrap="wrap" gap={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            {headerIcon}
            <Typography variant="h4" fontWeight={700}>
              {t(isMovie ? 'topPicksPage.pageTitleMovies' : 'topPicksPage.pageTitleSeries')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t(isMovie ? 'topPicksPage.subtitleMovies' : 'topPicksPage.subtitleSeries')}
            {config && t('topPicksPage.inLastDays', { count: config.timeWindowDays })}
          </Typography>
          {config?.lastRefreshedAt && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {t('topPicksPage.lastUpdated', {
                date: new Date(config.lastRefreshedAt).toLocaleDateString(),
              })}
            </Typography>
          )}
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v: ViewMode | null) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="grid">
            <GridViewIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {items.length === 0 && !error ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t(isMovie ? 'topPicksPage.emptyMovies' : 'topPicksPage.emptySeries')}
        </Alert>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={item.id}>
              <Box position="relative">
                <MoviePoster
                  title={item.title}
                  year={item.year}
                  posterUrl={item.posterUrl}
                  genres={item.genres}
                  rating={item.communityRating}
                  overview={item.overview}
                  userRating={getRating(item.mediaType, item.id)}
                  onRate={(rating) => handleRate(item.id, rating)}
                  responsive
                  isWatching={item.mediaType === 'series' ? isWatching(item.id) : undefined}
                  onWatchingToggle={item.mediaType === 'series' ? () => toggleWatching(item.id) : undefined}
                  size={item.mediaType === 'series' ? 'medium' : undefined}
                  onClick={() => navigate(`/${item.mediaType === 'movie' ? 'movies' : 'series'}/${item.id}`)}
                />
                <RankBadge rank={item.rank} size="large" />
                <Chip
                  icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                  label={item.uniqueViewers}
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    fontSize: '0.7rem',
                    height: 24,
                    '& .MuiChip-icon': { color: 'white' },
                  }}
                />
                {item.mediaType === 'series' && item.network && (
                  <Chip
                    label={item.network}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(139, 92, 246, 0.9)',
                      color: 'white',
                      fontSize: '0.65rem',
                      height: 20,
                      maxWidth: 80,
                      '& .MuiChip-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  />
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {items.map((item) => (
            <Card
              key={item.id}
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                cursor: item.mediaType === 'movie' ? 'pointer' : undefined,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                },
              }}
              onClick={item.mediaType === 'movie' ? () => navigate(`/movies/${item.id}`) : undefined}
            >
              <CardContent sx={{ display: 'flex', gap: 3, p: 2 }}>
                <RankBadge rank={item.rank} size="xlarge" absolute={false} />

                <Box
                  component="img"
                  src={item.posterUrl || undefined}
                  alt={item.title}
                  sx={{
                    width: 80,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 1,
                    backgroundColor: 'grey.800',
                    flexShrink: 0,
                  }}
                />

                <Box flex={1} minWidth={0}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight={600} noWrap>
                      {item.title}
                    </Typography>
                    {item.mediaType === 'series' && item.network && (
                      <Chip
                        label={item.network}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(139, 92, 246, 0.2)',
                          fontSize: '0.7rem',
                          height: 22,
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {item.year} {item.genres?.length > 0 && `• ${item.genres.slice(0, 3).join(', ')}`}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.overview || t('common.noDescription')}
                  </Typography>
                </Box>

                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="flex-end"
                  justifyContent="center"
                  gap={1}
                  flexShrink={0}
                >
                  <Chip
                    icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                    label={t('topPicksPage.viewersCount', { count: item.uniqueViewers })}
                    size="small"
                    sx={{
                      backgroundColor: item.mediaType === 'movie'
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(139, 92, 246, 0.2)',
                    }}
                  />
                  <Chip
                    icon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                    label={item.mediaType === 'movie'
                      ? item.playCount <= 10
                        ? t('topPicksPage.playsCount', { count: item.playCount })
                        : t('topPicksPage.playsPlus')
                      : t('topPicksPage.episodesWatched', { count: item.totalEpisodesWatched })}
                    size="small"
                    variant="outlined"
                  />
                  {item.mediaType === 'series' && item.avgCompletionRate > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {t('topPicksPage.avgCompletion', {
                        pct: Math.round(item.avgCompletionRate * 100),
                      })}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}
