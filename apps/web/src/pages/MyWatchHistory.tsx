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
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
  Snackbar,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import FavoriteIcon from '@mui/icons-material/Favorite'
import SearchIcon from '@mui/icons-material/Search'
import HistoryIcon from '@mui/icons-material/History'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha'
import { MoviePoster } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'
import { useWatching } from '@/hooks/useWatching'
import { useUserRatings } from '@/hooks/useUserRatings'
import { useViewMode } from '@/hooks/useViewMode'
import { WatchHistoryMovieListItem, WatchHistorySeriesListItem } from './watch-history/components'

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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user } = useAuth()
  const { isWatching, toggleWatching } = useWatching()
  const { getRating, setRating } = useUserRatings()
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
  const { viewMode, setViewMode } = useViewMode('watchHistory')
  const [searchQuery, setSearchQuery] = useState('')

  // Mark unwatched state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'movie' | 'series'
    id: string
    title: string
  } | null>(null)
  const [markingUnwatched, setMarkingUnwatched] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Check if user can manage watch history (admin or has permission)
  const canManage = user?.isAdmin || user?.canManageWatchHistory

  const handleMarkUnwatched = async () => {
    if (!confirmDialog || !user) return

    setMarkingUnwatched(true)
    try {
      const endpoint = confirmDialog.type === 'movie'
        ? `/api/users/${user.id}/watch-history/movies/${confirmDialog.id}`
        : `/api/users/${user.id}/watch-history/series/${confirmDialog.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        // Remove from local state
        if (confirmDialog.type === 'movie') {
          setMovieHistory(prev => prev.filter(m => m.movie_id !== confirmDialog.id))
          setMoviePagination(prev => ({ ...prev, total: prev.total - 1 }))
        } else {
          setSeriesHistory(prev => prev.filter(s => s.series_id !== confirmDialog.id))
          setSeriesPagination(prev => ({ ...prev, total: prev.total - 1 }))
        }
        setSnackbar({ open: true, message: `"${confirmDialog.title}" marked as unwatched`, severity: 'success' })
      } else {
        const error = await response.json()
        setSnackbar({ open: true, message: error.error || 'Failed to mark as unwatched', severity: 'error' })
      }
    } catch (err) {
      console.error('Failed to mark as unwatched:', err)
      setSnackbar({ open: true, message: 'Failed to mark as unwatched', severity: 'error' })
    } finally {
      setMarkingUnwatched(false)
      setConfirmDialog(null)
    }
  }

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
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={{ xs: 0, sm: 1 }}>
            <HistoryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Watch History
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              {moviePagination.total.toLocaleString()} movies • {seriesPagination.total.toLocaleString()} series watched
            </Typography>
          )}
        </Box>
        {/* Grid/List toggle always in upper right */}
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48,
            }
          }}
        >
          <Tab 
            icon={<MovieIcon />} 
            iconPosition="start" 
            label={`Movies (${moviePagination.total.toLocaleString()})`}
            sx={{
              color: tabValue === 0 ? '#6366f1' : 'text.secondary',
              '&.Mui-selected': { color: '#6366f1' },
            }}
          />
          <Tab 
            icon={<TvIcon />} 
            iconPosition="start" 
            label={`Series (${seriesPagination.total.toLocaleString()})`}
            sx={{
              color: tabValue === 1 ? '#ec4899' : 'text.secondary',
              '&.Mui-selected': { color: '#ec4899' },
            }}
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
            <ToggleButton value="recent">
              <AccessTimeIcon fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Recent'}
            </ToggleButton>
            <ToggleButton value="plays">
              <TrendingUpIcon fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Most Played'}
            </ToggleButton>
            <ToggleButton value="title">
              <SortByAlphaIcon fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'A-Z'}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {isLoading && <CircularProgress size={20} />}
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
                    <Grid item xs={6} sm={4} md={3} lg={2} key={item.movie_id}>
                      <Box 
                        position="relative"
                        sx={{
                          '&:hover .mark-unwatched-btn': {
                            opacity: 1,
                          }
                        }}
                      >
                        <MoviePoster
                          title={item.title}
                          year={item.year}
                          posterUrl={item.poster_url}
                          genres={item.genres}
                          rating={item.community_rating}
                          overview={item.overview}
                          userRating={getRating('movie', item.movie_id)}
                          onRate={(rating) => setRating('movie', item.movie_id, rating)}
                          responsive
                          onClick={() => navigate(`/movies/${item.movie_id}`)}
                        />
                        {/* Play count badge - cap display at 5x, show "Rewatched" for higher */}
                        {item.play_count > 1 && (
                          <Chip
                            label={item.play_count <= 5 ? `${item.play_count}x` : 'Rewatched'}
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
                        {/* Mark Unwatched button */}
                        {canManage && (
                          <Tooltip title="Mark as unwatched">
                            <IconButton
                              className="mark-unwatched-btn"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmDialog({
                                  open: true,
                                  type: 'movie',
                                  id: item.movie_id,
                                  title: item.title
                                })
                              }}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                '&:hover': {
                                  backgroundColor: 'error.main',
                                },
                              }}
                            >
                              <VisibilityOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <Box display="flex" flexDirection="column" gap={2}>
                  {filteredMovies.map((item) => (
                    <WatchHistoryMovieListItem
                      key={item.movie_id}
                      movie={item}
                      userRating={getRating('movie', item.movie_id)}
                      onRate={(rating) => setRating('movie', item.movie_id, rating)}
                      canManage={canManage}
                      onMarkUnwatched={() => setConfirmDialog({
                        open: true,
                        type: 'movie',
                        id: item.movie_id,
                        title: item.title
                      })}
                    />
                  ))}
                </Box>
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
                    <Grid item xs={6} sm={4} md={3} lg={2} key={item.series_id}>
                      <Box 
                        sx={{ 
                          '&:hover .mark-unwatched-btn': {
                            opacity: 1,
                          }
                        }}
                      >
                        <Box position="relative">
                          <MoviePoster
                            title={item.title}
                            year={item.year}
                            posterUrl={item.poster_url}
                            genres={item.genres}
                            rating={item.community_rating}
                            overview={item.overview}
                            userRating={getRating('series', item.series_id)}
                            onRate={(rating) => setRating('series', item.series_id, rating)}
                            responsive
                            hideRating
                            isWatching={isWatching(item.series_id)}
                            onWatchingToggle={() => toggleWatching(item.series_id)}
                            onClick={() => navigate(`/series/${item.series_id}`)}
                          />
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
                          {/* Mark Unwatched button */}
                          {canManage && (
                            <Tooltip title="Mark all episodes as unwatched">
                              <IconButton
                                className="mark-unwatched-btn"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmDialog({
                                    open: true,
                                    type: 'series',
                                    id: item.series_id,
                                    title: item.title
                                  })
                                }}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  backgroundColor: 'rgba(0,0,0,0.7)',
                                  color: 'white',
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  '&:hover': {
                                    backgroundColor: 'error.main',
                                  },
                                }}
                              >
                                <VisibilityOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        {/* Episodes progress below poster */}
                        <Box sx={{ mt: 0.5 }}>
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                              {item.episodes_watched} / {item.total_episodes} eps
                            </Typography>
                            <Typography 
                              variant="caption" 
                              fontWeight={600}
                              fontSize="0.7rem"
                              sx={{ 
                                color: item.episodes_watched === item.total_episodes ? 'success.main' : 'text.secondary' 
                              }}
                            >
                              {Math.round((item.episodes_watched / item.total_episodes) * 100)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((item.episodes_watched / item.total_episodes) * 100, 100)}
                            sx={{
                              height: 3,
                              borderRadius: 1,
                              mt: 0.5,
                              backgroundColor: 'grey.800',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: item.episodes_watched === item.total_episodes ? 'success.main' : 'primary.main',
                              },
                            }}
                          />
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <Box display="flex" flexDirection="column" gap={2}>
                  {filteredSeries.map((item) => (
                    <WatchHistorySeriesListItem
                      key={item.series_id}
                      series={item}
                      userRating={getRating('series', item.series_id)}
                      onRate={(rating) => setRating('series', item.series_id, rating)}
                      canManage={canManage}
                      onMarkUnwatched={() => setConfirmDialog({
                        open: true,
                        type: 'series',
                        id: item.series_id,
                        title: item.title
                      })}
                    />
                  ))}
                </Box>
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

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmDialog?.open}
        onClose={() => setConfirmDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mark as Unwatched?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog?.type === 'movie' 
              ? `This will mark "${confirmDialog?.title}" as unwatched in your media server and remove it from your Aperture watch history.`
              : `This will mark all episodes of "${confirmDialog?.title}" as unwatched in your media server and remove them from your Aperture watch history.`
            }
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontWeight: 500, color: 'warning.main' }}>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)} disabled={markingUnwatched}>
            Cancel
          </Button>
          <Button 
            onClick={handleMarkUnwatched} 
            color="error" 
            variant="contained"
            disabled={markingUnwatched}
          >
            {markingUnwatched ? 'Marking...' : 'Mark Unwatched'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  )
}
