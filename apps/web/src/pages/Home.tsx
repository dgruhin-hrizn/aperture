import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Skeleton,
  IconButton,
  Alert,
  Chip,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import MovieIcon from '@mui/icons-material/Movie'
import FavoriteIcon from '@mui/icons-material/Favorite'
import HistoryIcon from '@mui/icons-material/History'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PsychologyIcon from '@mui/icons-material/Psychology'
import RefreshIcon from '@mui/icons-material/Refresh'
import { MoviePoster } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

interface Recommendation {
  movie_id: string
  rank: number
  final_score: number
  movie: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    overview: string | null
  }
}

interface WatchHistoryItem {
  movie_id: string
  play_count: number
  is_favorite: boolean
  last_played_at: string | null
  title: string
  year: number | null
  poster_url: string | null
  genres: string[]
  community_rating: number | null
  overview: string | null
}

interface UserStats {
  watchedCount: number
  favoritesCount: number
  recommendationsCount: number
}

interface TasteProfile {
  synopsis: string
  updatedAt: string
  stats: {
    totalWatched: number
    topGenres: string[]
    avgRating: number
    favoriteDecade: string | null
    recentFavorites: string[]
  }
}

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recentlyWatched, setRecentlyWatched] = useState<WatchHistoryItem[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null)
  const [loadingTasteProfile, setLoadingTasteProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recsScrollPosition, setRecsScrollPosition] = useState(0)
  const [recentScrollPosition, setRecentScrollPosition] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch all data in parallel
        const [recsResponse, historyResponse, statsResponse, tasteResponse] = await Promise.all([
          fetch(`/api/recommendations/${user.id}`, { credentials: 'include' }),
          fetch(`/api/users/${user.id}/watch-history?page=1&pageSize=20&sortBy=recent`, { credentials: 'include' }),
          fetch(`/api/users/${user.id}/stats`, { credentials: 'include' }),
          fetch(`/api/users/${user.id}/taste-profile`, { credentials: 'include' }),
        ])

        // Process recommendations
        if (recsResponse.ok) {
          const recsData = await recsResponse.json()
          setRecommendations(recsData.recommendations || [])
        }

        // Process watch history
        if (historyResponse.ok) {
          const historyData = await historyResponse.json()
          setRecentlyWatched(historyData.history || [])
        }

        // Process stats (accurate counts from API)
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats({
            watchedCount: statsData.watchedCount,
            favoritesCount: statsData.favoritesCount,
            recommendationsCount: statsData.recommendationsCount,
          })
        }

        // Process taste profile
        if (tasteResponse.ok) {
          const tasteData = await tasteResponse.json()
          setTasteProfile(tasteData)
        }
      } catch (err) {
        console.error('Failed to fetch home data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const regenerateTasteProfile = async () => {
    if (!user) return
    setLoadingTasteProfile(true)
    try {
      const response = await fetch(`/api/users/${user.id}/taste-profile/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setTasteProfile(data)
      }
    } catch (err) {
      console.error('Failed to regenerate taste profile:', err)
    } finally {
      setLoadingTasteProfile(false)
    }
  }

  const scrollCarousel = (direction: 'left' | 'right', type: 'recs' | 'recent') => {
    const scrollAmount = 600
    if (type === 'recs') {
      setRecsScrollPosition((prev) =>
        direction === 'left' ? Math.max(0, prev - scrollAmount) : prev + scrollAmount
      )
    } else {
      setRecentScrollPosition((prev) =>
        direction === 'left' ? Math.max(0, prev - scrollAmount) : prev + scrollAmount
      )
    }
  }

  const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, flex: 1 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <Box sx={{ color: 'primary.main' }}>{icon}</Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {value.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )

  const CarouselSection = ({
    title,
    subtitle,
    items,
    scrollPosition,
    onScroll,
    _type,
    emptyMessage,
    viewAllPath,
  }: {
    title: string
    subtitle?: string
    items: (Recommendation | WatchHistoryItem)[]
    scrollPosition: number
    onScroll: (direction: 'left' | 'right') => void
    _type: 'recommendations' | 'history'
    emptyMessage: string
    viewAllPath: string
  }) => (
    <Box mb={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            onClick={() => onScroll('left')}
            disabled={scrollPosition === 0}
            size="small"
            sx={{ bgcolor: 'background.paper' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            onClick={() => onScroll('right')}
            size="small"
            sx={{ bgcolor: 'background.paper' }}
          >
            <ChevronRightIcon />
          </IconButton>
          <Button
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate(viewAllPath)}
            size="small"
          >
            View All
          </Button>
        </Box>
      </Box>

      {items.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {emptyMessage}
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            overflow: 'hidden',
            pb: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              transform: `translateX(-${scrollPosition}px)`,
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            {items.map((item) => {
              const isRec = 'rank' in item
              const movie = isRec ? (item as Recommendation).movie : item as WatchHistoryItem
              const movieId = isRec ? (item as Recommendation).movie_id : (item as WatchHistoryItem).movie_id

              return (
                <Box key={movieId} position="relative" flexShrink={0}>
                  <MoviePoster
                    title={isRec ? movie.title : (item as WatchHistoryItem).title}
                    year={isRec ? movie.year : (item as WatchHistoryItem).year}
                    posterUrl={isRec ? movie.poster_url : (item as WatchHistoryItem).poster_url}
                    genres={isRec ? movie.genres : (item as WatchHistoryItem).genres}
                    rating={isRec ? undefined : (item as WatchHistoryItem).community_rating}
                    overview={isRec ? movie.overview : (item as WatchHistoryItem).overview}
                    score={isRec ? (item as Recommendation).final_score : undefined}
                    showScore={isRec}
                    hideRating={isRec}
                    size="medium"
                    onClick={() => navigate(`/movies/${movieId}`)}
                  />
                  {!isRec && (item as WatchHistoryItem).play_count > 1 && (
                    <Chip
                      label={`${(item as WatchHistoryItem).play_count}x`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        backgroundColor: 'primary.main',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  )}
                  {!isRec && (item as WatchHistoryItem).is_favorite && (
                    <FavoriteIcon
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        color: 'error.main',
                        fontSize: 20,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                      }}
                    />
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      )}
    </Box>
  )

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Box display="flex" gap={2} mb={4}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={80} sx={{ flex: 1, borderRadius: 2 }} />
          ))}
        </Box>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Box display="flex" gap={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="rectangular" width={154} height={231} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Typography variant="h4" fontWeight={700} mb={1}>
        Welcome back, {user?.displayName || user?.username}
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Here's what we've picked for you based on your watch history
      </Typography>

      {/* Quick Stats */}
      {stats && (
        <Box display="flex" gap={2} mb={4} flexWrap="wrap">
          <StatCard
            icon={<MovieIcon fontSize="large" />}
            label="Movies Watched"
            value={stats.watchedCount}
          />
          <StatCard
            icon={<FavoriteIcon fontSize="large" />}
            label="Favorites"
            value={stats.favoritesCount}
          />
          <StatCard
            icon={<AutoAwesomeIcon fontSize="large" />}
            label="AI Recommendations"
            value={stats.recommendationsCount}
          />
        </Box>
      )}

      {/* Taste Profile Card */}
      {tasteProfile && tasteProfile.stats.totalWatched > 0 && (
        <Card
          sx={{
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PsychologyIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Your Movie Taste Profile
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    How our AI understands your preferences
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="Regenerate your taste profile">
                <IconButton
                  onClick={regenerateTasteProfile}
                  disabled={loadingTasteProfile}
                  size="small"
                  sx={{
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  {loadingTasteProfile ? (
                    <CircularProgress size={20} />
                  ) : (
                    <RefreshIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Synopsis */}
            <Typography
              variant="body1"
              sx={{
                mb: 3,
                lineHeight: 1.8,
                color: 'text.primary',
                fontStyle: 'italic',
                pl: 2,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
              }}
            >
              "{tasteProfile.synopsis}"
            </Typography>

            {/* Top Genres */}
            {tasteProfile.stats.topGenres.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>
                  Your Top Genres
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {tasteProfile.stats.topGenres.map((genre, index) => (
                    <Chip
                      key={genre}
                      label={genre}
                      size="small"
                      sx={{
                        bgcolor: index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'action.selected',
                        color: index < 2 ? 'white' : 'text.primary',
                        fontWeight: index < 2 ? 600 : 400,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Quick Stats Row */}
            <Box
              display="flex"
              gap={3}
              flexWrap="wrap"
              sx={{
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              {tasteProfile.stats.favoriteDecade && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Favorite Era
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {tasteProfile.stats.favoriteDecade}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Avg. Movie Rating
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {tasteProfile.stats.avgRating.toFixed(1)}/10
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Movies Analyzed
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {tasteProfile.stats.totalWatched}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Your Top Picks (Recommendations) */}
      <CarouselSection
        title="Your Top Picks"
        subtitle="AI-powered recommendations based on your taste"
        items={recommendations.slice(0, 20)}
        scrollPosition={recsScrollPosition}
        onScroll={(dir) => scrollCarousel(dir, 'recs')}
        _type="recommendations"
        emptyMessage="No recommendations yet. Your personalized picks will appear here once they're generated."
        viewAllPath="/recommendations"
      />

      {/* Recently Watched */}
      <CarouselSection
        title="Recently Watched"
        subtitle="Continue where you left off"
        items={recentlyWatched.slice(0, 20)}
        scrollPosition={recentScrollPosition}
        onScroll={(dir) => scrollCarousel(dir, 'recent')}
        _type="history"
        emptyMessage="No watch history yet. Movies you watch will appear here."
        viewAllPath="/history"
      />

      {/* Browse Movies CTA */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, mt: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <HistoryIcon sx={{ color: 'primary.main', fontSize: 40 }} />
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Discover More
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Browse the full movie library to find something new
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" onClick={() => navigate('/movies')}>
            Browse Movies
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}

