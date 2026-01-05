import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Pagination,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import FavoriteIcon from '@mui/icons-material/Favorite'
import SearchIcon from '@mui/icons-material/Search'
import HistoryIcon from '@mui/icons-material/History'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { MoviePoster } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

interface MovieWatchHistoryItem {
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

interface SeriesWatchHistoryItem {
  series_id: string
  title: string
  year: number | null
  poster_url: string | null
  genres: string[]
  community_rating: number | null
  overview: string | null
  episodes_watched: number
  total_episodes: number
  total_plays: number
  last_played_at: string | null
  is_favorite: boolean
}

interface WatchHistoryResponse<T> {
  history: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function MyWatchHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tabValue, setTabValue] = useState(0) // 0 = Movies, 1 = Series
  
  // Movies state
  const [movieHistory, setMovieHistory] = useState<MovieWatchHistoryItem[]>([])
  const [movieLoading, setMovieLoading] = useState(true)
  const [moviePagination, setMoviePagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [movieSortBy, setMovieSortBy] = useState<'recent' | 'plays' | 'title'>('recent')
  
  // Series state
  const [seriesHistory, setSeriesHistory] = useState<SeriesWatchHistoryItem[]>([])
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [seriesPagination, setSeriesPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [seriesSortBy, setSeriesSortBy] = useState<'recent' | 'plays' | 'title'>('recent')
  
  // Shared state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchMovieHistory = useCallback(async (page: number, sort: string) => {
    if (!user) return
    
    setMovieLoading(true)
    try {
      const response = await fetch(
        `/api/users/${user.id}/watch-history?page=${page}&pageSize=50&sortBy=${sort}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data: WatchHistoryResponse<MovieWatchHistoryItem> = await response.json()
        setMovieHistory(data.history)
        setMoviePagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch movie watch history:', err)
    } finally {
      setMovieLoading(false)
    }
  }, [user])

  const fetchSeriesHistory = useCallback(async (page: number, sort: string) => {
    if (!user) return
    
    setSeriesLoading(true)
    try {
      const response = await fetch(
        `/api/users/${user.id}/series-watch-history?page=${page}&pageSize=50&sortBy=${sort}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data: WatchHistoryResponse<SeriesWatchHistoryItem> = await response.json()
        setSeriesHistory(data.history)
        setSeriesPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch series watch history:', err)
    } finally {
      setSeriesLoading(false)
    }
  }, [user])

  // Fetch both on mount
  useEffect(() => {
    fetchMovieHistory(1, movieSortBy)
    fetchSeriesHistory(1, seriesSortBy)
  }, [fetchMovieHistory, fetchSeriesHistory, movieSortBy, seriesSortBy])

  const handleMoviePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    fetchMovieHistory(page, movieSortBy)
  }

  const handleSeriesPageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    fetchSeriesHistory(page, seriesSortBy)
  }

  const handleMovieSortChange = (_: React.MouseEvent<HTMLElement>, newSort: 'recent' | 'plays' | 'title' | null) => {
    if (newSort) {
      setMovieSortBy(newSort)
      fetchMovieHistory(1, newSort)
    }
  }

  const handleSeriesSortChange = (_: React.MouseEvent<HTMLElement>, newSort: 'recent' | 'plays' | 'title' | null) => {
    if (newSort) {
      setSeriesSortBy(newSort)
      fetchSeriesHistory(1, newSort)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  // Filter movies by search query
  const filteredMovies = searchQuery
    ? movieHistory.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.genres?.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : movieHistory

  // Filter series by search query
  const filteredSeries = searchQuery
    ? seriesHistory.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.genres?.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : seriesHistory

  const isLoading = tabValue === 0 ? movieLoading : seriesLoading
  const currentHistory = tabValue === 0 ? filteredMovies : filteredSeries
  const currentPagination = tabValue === 0 ? moviePagination : seriesPagination

  if (movieLoading && seriesLoading && movieHistory.length === 0 && seriesHistory.length === 0) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={2}>
          {[...Array(12)].map((_, i) => (
            <Grid item key={i}>
              <Skeleton variant="rectangular" width={140} height={210} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <HistoryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Watch History
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {moviePagination.total.toLocaleString()} movies • {seriesPagination.total.toLocaleString()} series watched
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }
          }}
        >
          <Tab 
            icon={<MovieIcon />} 
            iconPosition="start" 
            label={`Movies (${moviePagination.total.toLocaleString()})`} 
          />
          <Tab 
            icon={<TvIcon />} 
            iconPosition="start" 
            label={`Series (${seriesPagination.total.toLocaleString()})`} 
          />
        </Tabs>
      </Box>

      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <TextField
            size="small"
            placeholder={`Search ${tabValue === 0 ? 'movies' : 'series'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
          <ToggleButtonGroup
            value={tabValue === 0 ? movieSortBy : seriesSortBy}
            exclusive
            onChange={tabValue === 0 ? handleMovieSortChange : handleSeriesSortChange}
            size="small"
          >
            <ToggleButton value="recent">Recent</ToggleButton>
            <ToggleButton value="plays">Most Played</ToggleButton>
            <ToggleButton value="title">A-Z</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {isLoading && <CircularProgress size={20} />}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Movies Tab Content */}
      {tabValue === 0 && (
        <>
          {filteredMovies.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {searchQuery
                ? `No movies found matching "${searchQuery}"`
                : 'No watch history found. Movies you watch will appear here after the watch history sync runs.'}
            </Alert>
          ) : (
            <>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <Grid container spacing={2}>
                  {filteredMovies.map((item) => (
                    <Grid item key={item.movie_id}>
                      <Box position="relative">
                        <MoviePoster
                          title={item.title}
                          year={item.year}
                          posterUrl={item.poster_url}
                          genres={item.genres}
                          rating={item.community_rating}
                          overview={item.overview}
                          size="small"
                          onClick={() => navigate(`/movies/${item.movie_id}`)}
                        />
                        {/* Play count badge */}
                        {item.play_count > 1 && (
                          <Chip
                            label={`${item.play_count}x`}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              backgroundColor: 'primary.main',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              height: 22,
                            }}
                          />
                        )}
                        {/* Favorite badge */}
                        {item.is_favorite && (
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
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Movie</TableCell>
                        <TableCell align="center">Plays</TableCell>
                        <TableCell align="center">Rating</TableCell>
                        <TableCell align="right">Last Watched</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMovies.map((item) => (
                        <TableRow 
                          key={item.movie_id} 
                          hover 
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/movies/${item.movie_id}`)}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={2}>
                              <Box
                                component="img"
                                src={item.poster_url || undefined}
                                alt={item.title}
                                sx={{
                                  width: 40,
                                  height: 60,
                                  objectFit: 'cover',
                                  borderRadius: 0.5,
                                  backgroundColor: 'grey.800',
                                }}
                              />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {item.title}
                                  {item.is_favorite && (
                                    <FavoriteIcon sx={{ ml: 0.5, fontSize: 14, color: 'error.main', verticalAlign: 'middle' }} />
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.year} • {item.genres?.slice(0, 2).join(', ')}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={item.play_count} 
                              size="small" 
                              color={item.play_count > 3 ? 'primary' : 'default'}
                              variant={item.play_count > 1 ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {item.community_rating ? (
                              <Typography variant="body2">
                                {Number(item.community_rating).toFixed(1)}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(item.last_played_at)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Pagination */}
              {moviePagination.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={moviePagination.totalPages}
                    page={moviePagination.page}
                    onChange={handleMoviePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {/* Series Tab Content */}
      {tabValue === 1 && (
        <>
          {filteredSeries.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {searchQuery
                ? `No series found matching "${searchQuery}"`
                : 'No watch history found. Series you watch will appear here after the watch history sync runs.'}
            </Alert>
          ) : (
            <>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <Grid container spacing={2}>
                  {filteredSeries.map((item) => (
                    <Grid item key={item.series_id}>
                      <Box position="relative">
                        <MoviePoster
                          title={item.title}
                          year={item.year}
                          posterUrl={item.poster_url}
                          genres={item.genres}
                          rating={item.community_rating}
                          overview={item.overview}
                          size="small"
                          hideRating
                          onClick={() => navigate(`/series/${item.series_id}`)}
                        />
                        {/* Episodes progress badge */}
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            px: 1,
                            py: 0.5,
                            borderBottomLeftRadius: 4,
                            borderBottomRightRadius: 4,
                          }}
                        >
                          <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="white" fontWeight={600}>
                              {item.episodes_watched}/{item.total_episodes} eps
                            </Typography>
                            {item.total_plays > item.episodes_watched && (
                              <Typography variant="caption" color="primary.light" fontWeight={600}>
                                {item.total_plays} plays
                              </Typography>
                            )}
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((item.episodes_watched / item.total_episodes) * 100, 100)}
                            sx={{
                              height: 3,
                              borderRadius: 1,
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: item.episodes_watched === item.total_episodes ? 'success.main' : 'primary.main',
                              },
                            }}
                          />
                        </Box>
                        {/* Favorite badge */}
                        {item.is_favorite && (
                          <FavoriteIcon
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              color: 'error.main',
                              fontSize: 20,
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                            }}
                          />
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Series</TableCell>
                        <TableCell align="center">Progress</TableCell>
                        <TableCell align="center">Plays</TableCell>
                        <TableCell align="center">Rating</TableCell>
                        <TableCell align="right">Last Watched</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSeries.map((item) => (
                        <TableRow 
                          key={item.series_id} 
                          hover 
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/series/${item.series_id}`)}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={2}>
                              <Box
                                component="img"
                                src={item.poster_url || undefined}
                                alt={item.title}
                                sx={{
                                  width: 40,
                                  height: 60,
                                  objectFit: 'cover',
                                  borderRadius: 0.5,
                                  backgroundColor: 'grey.800',
                                }}
                              />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {item.title}
                                  {item.is_favorite && (
                                    <FavoriteIcon sx={{ ml: 0.5, fontSize: 14, color: 'error.main', verticalAlign: 'middle' }} />
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.year} • {item.genres?.slice(0, 2).join(', ')}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ minWidth: 100 }}>
                              <Typography variant="caption" color="text.secondary">
                                {item.episodes_watched}/{item.total_episodes} episodes
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min((item.episodes_watched / item.total_episodes) * 100, 100)}
                                sx={{
                                  height: 4,
                                  borderRadius: 1,
                                  mt: 0.5,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: item.episodes_watched === item.total_episodes ? 'success.main' : 'primary.main',
                                  },
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={item.total_plays} 
                              size="small" 
                              color={item.total_plays > 10 ? 'primary' : 'default'}
                              variant={item.total_plays > 1 ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {item.community_rating ? (
                              <Typography variant="body2">
                                {Number(item.community_rating).toFixed(1)}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(item.last_played_at)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Pagination */}
              {seriesPagination.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={seriesPagination.totalPages}
                    page={seriesPagination.page}
                    onChange={handleSeriesPageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  )
}
