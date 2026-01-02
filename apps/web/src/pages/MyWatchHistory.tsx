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
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import FavoriteIcon from '@mui/icons-material/Favorite'
import SearchIcon from '@mui/icons-material/Search'
import HistoryIcon from '@mui/icons-material/History'
import { MoviePoster } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

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

interface WatchHistoryResponse {
  history: WatchHistoryItem[]
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
  const [history, setHistory] = useState<WatchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [sortBy, setSortBy] = useState<'recent' | 'plays' | 'title'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchHistory = useCallback(async (page: number, sort: string) => {
    if (!user) return
    
    setLoading(true)
    try {
      const response = await fetch(
        `/api/users/${user.id}/watch-history?page=${page}&pageSize=50&sortBy=${sort}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data: WatchHistoryResponse = await response.json()
        setHistory(data.history)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch watch history:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchHistory(pagination.page, sortBy)
  }, [fetchHistory, sortBy])

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    fetchHistory(page, sortBy)
  }

  const handleSortChange = (_: React.MouseEvent<HTMLElement>, newSort: 'recent' | 'plays' | 'title' | null) => {
    if (newSort) {
      setSortBy(newSort)
      fetchHistory(1, newSort)
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

  // Filter by search query (client-side for simplicity)
  const filteredHistory = searchQuery
    ? history.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.genres?.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : history

  if (loading && history.length === 0) {
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
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <HistoryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Watch History
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {pagination.total.toLocaleString()} movies you've watched
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <TextField
            size="small"
            placeholder="Search history..."
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
            value={sortBy}
            exclusive
            onChange={handleSortChange}
            size="small"
          >
            <ToggleButton value="recent">Recent</ToggleButton>
            <ToggleButton value="plays">Most Played</ToggleButton>
            <ToggleButton value="title">A-Z</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {loading && <CircularProgress size={20} />}
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

      {filteredHistory.length === 0 ? (
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
              {filteredHistory.map((item) => (
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
                  {filteredHistory.map((item) => (
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
          {pagination.totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

