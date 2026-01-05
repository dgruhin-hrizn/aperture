import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Skeleton,
  Alert,
  Chip,
  Avatar,
} from '@mui/material'
import InsightsIcon from '@mui/icons-material/Insights'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FavoriteIcon from '@mui/icons-material/Favorite'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PersonIcon from '@mui/icons-material/Person'
import VideocamIcon from '@mui/icons-material/Videocam'
import BusinessIcon from '@mui/icons-material/Business'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'

interface WatchStats {
  genreDistribution: { genre: string; count: number; percentage: number }[]
  watchTimeline: { month: string; movies: number; episodes: number }[]
  decadeDistribution: { decade: string; count: number }[]
  ratingDistribution: { rating: string; count: number }[]
  totalMovies: number
  totalEpisodes: number
  totalWatchTimeMinutes: number
  totalPlays: number
  totalFavorites: number
  totalSeries: number
  topActors: { name: string; thumb: string | null; count: number }[]
  topDirectors: { name: string; thumb: string | null; count: number }[]
  topStudios: { name: string; thumb: string | null; count: number }[]
  topNetworks: { name: string; thumb: string | null; count: number }[]
  seriesGenreDistribution: { genre: string; count: number }[]
}

// Rich color palette for charts
const GENRE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#f472b6', '#fb7185', '#fb923c',
]

const DECADE_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']

export function WatchStatsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<WatchStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      try {
        const response = await fetch(`/api/users/${user.id}/watch-stats`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setStats(data)
          setError(null)
        } else {
          setError('Failed to load watch statistics')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user])

  const formatWatchTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) {
      return `${days}d ${hours % 24}h`
    }
    return `${hours}h ${minutes % 60}m`
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          {[...Array(6)].map((_, i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Box>
    )
  }

  if (!stats) return null

  const hasData = stats.totalMovies > 0 || stats.totalEpisodes > 0

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <InsightsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Watch Stats
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Your personal viewing statistics and insights
        </Typography>
      </Box>

      {!hasData ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No watch history data yet. Your statistics will appear here once you've watched some content.
        </Alert>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} mb={4}>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <MovieIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {stats.totalMovies}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Movies
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <TvIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {stats.totalSeries}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    TV Series
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <PlayArrowIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {stats.totalEpisodes}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Episodes
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <AccessTimeIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {formatWatchTime(stats.totalWatchTimeMinutes)}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Watch Time
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <PlayArrowIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {stats.totalPlays}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Total Plays
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <FavoriteIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                  <Typography variant="h4" fontWeight={700} color="white">
                    {stats.totalFavorites}
                  </Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Favorites
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row 1 */}
          <Grid container spacing={3} mb={3}>
            {/* Genre Distribution */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Favorite Genres
                  </Typography>
                  {stats.genreDistribution.length > 0 ? (
                    <Box display="flex" alignItems="center" gap={2}>
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie
                            data={stats.genreDistribution.slice(0, 8)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="count"
                          >
                            {stats.genreDistribution.slice(0, 8).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={GENRE_COLORS[index % GENRE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1a1a1a', 
                              border: '1px solid #2a2a2a',
                              borderRadius: 8,
                              color: '#f5f5f5',
                            }}
                            itemStyle={{ color: '#f5f5f5' }}
                            formatter={(value, _name, props) => {
                              const payload = props.payload as { genre: string; percentage: number } | undefined
                              return [`${value} movies (${payload?.percentage || 0}%)`, payload?.genre || '']
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <Box flex={1}>
                        {stats.genreDistribution.slice(0, 8).map((item, index) => (
                          <Box key={item.genre} display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Box 
                              sx={{ 
                                width: 12, 
                                height: 12, 
                                borderRadius: '50%', 
                                backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length] 
                              }} 
                            />
                            <Typography variant="body2" flex={1} noWrap>
                              {item.genre}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.percentage}%
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No genre data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Watch Timeline */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Watching Activity
                  </Typography>
                  {stats.watchTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={stats.watchTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis 
                          dataKey="month" 
                          stroke="#666" 
                          fontSize={11}
                          tickFormatter={(value) => value.split(' ')[0]}
                        />
                        <YAxis stroke="#666" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid #2a2a2a',
                            borderRadius: 8 
                          }} 
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="movies" 
                          stackId="1"
                          stroke="#6366f1" 
                          fill="#6366f1" 
                          fillOpacity={0.6}
                          name="Movies"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="episodes" 
                          stackId="1"
                          stroke="#8b5cf6" 
                          fill="#8b5cf6" 
                          fillOpacity={0.6}
                          name="Episodes"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No timeline data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row 2 */}
          <Grid container spacing={3} mb={3}>
            {/* Decade Distribution */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Movies by Decade
                  </Typography>
                  {stats.decadeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.decadeDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis type="number" stroke="#666" fontSize={11} />
                        <YAxis type="category" dataKey="decade" stroke="#666" fontSize={11} width={50} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid #2a2a2a',
                            borderRadius: 8 
                          }} 
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                          {stats.decadeDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={DECADE_COLORS[index % DECADE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No decade data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Rating Distribution */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Rating Distribution
                  </Typography>
                  {stats.ratingDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.ratingDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="rating" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid #2a2a2a',
                            borderRadius: 8 
                          }}
                          formatter={(value) => [`${value} movies`, 'Count']}
                        />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No rating data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row 3 - Top Actors & Directors */}
          <Grid container spacing={3}>
            {/* Top Actors */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <PersonIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Most Watched Actors
                    </Typography>
                  </Box>
                  {stats.topActors.length > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {stats.topActors.map((actor, index) => (
                        <Box key={actor.name} display="flex" alignItems="center" gap={2}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ width: 20, textAlign: 'right', flexShrink: 0 }}
                          >
                            {index + 1}.
                          </Typography>
                          <Avatar
                            src={actor.thumb || undefined}
                            alt={actor.name}
                            sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: 'primary.dark',
                              fontSize: '0.875rem',
                              flexShrink: 0,
                            }}
                          >
                            {actor.name.charAt(0)}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                              <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                                {actor.name}
                              </Typography>
                              <Chip 
                                label={`${actor.count} films`} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                  ml: 1,
                                  flexShrink: 0,
                                }} 
                              />
                            </Box>
                            <Box 
                              sx={{ 
                                height: 4, 
                                borderRadius: 2, 
                                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                overflow: 'hidden'
                              }}
                            >
                              <Box 
                                sx={{ 
                                  height: '100%', 
                                  width: `${(actor.count / stats.topActors[0].count) * 100}%`,
                                  backgroundColor: '#6366f1',
                                  borderRadius: 2,
                                }} 
                              />
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No actor data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Top Directors */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <VideocamIcon sx={{ color: 'secondary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Most Watched Directors
                    </Typography>
                  </Box>
                  {stats.topDirectors.length > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {stats.topDirectors.map((director, index) => (
                        <Box key={director.name} display="flex" alignItems="center" gap={2}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ width: 20, textAlign: 'right', flexShrink: 0 }}
                          >
                            {index + 1}.
                          </Typography>
                          <Avatar
                            src={director.thumb || undefined}
                            alt={director.name}
                            sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: 'secondary.dark',
                              fontSize: '0.875rem',
                              flexShrink: 0,
                            }}
                          >
                            {director.name.charAt(0)}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                              <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                                {director.name}
                              </Typography>
                              <Chip 
                                label={`${director.count} films`} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                  ml: 1,
                                  flexShrink: 0,
                                }} 
                              />
                            </Box>
                            <Box 
                              sx={{ 
                                height: 4, 
                                borderRadius: 2, 
                                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                overflow: 'hidden'
                              }}
                            >
                              <Box 
                                sx={{ 
                                  height: '100%', 
                                  width: `${(director.count / stats.topDirectors[0].count) * 100}%`,
                                  backgroundColor: '#8b5cf6',
                                  borderRadius: 2,
                                }} 
                              />
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No director data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row 4 - Studios & Networks */}
          <Grid container spacing={3} mt={0}>
            {/* Top Studios */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <BusinessIcon sx={{ color: '#f97316' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Top Studios
                    </Typography>
                  </Box>
                  {stats.topStudios.length > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {stats.topStudios.map((studio, index) => (
                        <Box key={studio.name} display="flex" alignItems="center" gap={2}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ width: 20, textAlign: 'right', flexShrink: 0 }}
                          >
                            {index + 1}.
                          </Typography>
                          <Avatar
                            src={studio.thumb || undefined}
                            alt={studio.name}
                            variant="rounded"
                            sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: '#f97316',
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {studio.name.substring(0, 2).toUpperCase()}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                              <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                                {studio.name}
                              </Typography>
                              <Chip 
                                label={`${studio.count} films`} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                                  ml: 1,
                                  flexShrink: 0,
                                }} 
                              />
                            </Box>
                            <Box 
                              sx={{ 
                                height: 4, 
                                borderRadius: 2, 
                                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                                overflow: 'hidden'
                              }}
                            >
                              <Box 
                                sx={{ 
                                  height: '100%', 
                                  width: `${(studio.count / stats.topStudios[0].count) * 100}%`,
                                  backgroundColor: '#f97316',
                                  borderRadius: 2,
                                }} 
                              />
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No studio data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Top Networks */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <LiveTvIcon sx={{ color: '#06b6d4' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Top Networks
                    </Typography>
                  </Box>
                  {stats.topNetworks.length > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {stats.topNetworks.map((network, index) => (
                        <Box key={network.name} display="flex" alignItems="center" gap={2}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ width: 20, textAlign: 'right', flexShrink: 0 }}
                          >
                            {index + 1}.
                          </Typography>
                          <Avatar
                            src={network.thumb || undefined}
                            alt={network.name}
                            variant="rounded"
                            sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: '#06b6d4',
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {network.name.substring(0, 2).toUpperCase()}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                              <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                                {network.name}
                              </Typography>
                              <Chip 
                                label={`${network.count} series`} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(6, 182, 212, 0.2)',
                                  ml: 1,
                                  flexShrink: 0,
                                }} 
                              />
                            </Box>
                            <Box 
                              sx={{ 
                                height: 4, 
                                borderRadius: 2, 
                                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                                overflow: 'hidden'
                              }}
                            >
                              <Box 
                                sx={{ 
                                  height: '100%', 
                                  width: `${(network.count / stats.topNetworks[0].count) * 100}%`,
                                  backgroundColor: '#06b6d4',
                                  borderRadius: 2,
                                }} 
                              />
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No network data available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  )
}

