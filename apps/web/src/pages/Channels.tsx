import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Skeleton,
  Alert,
  Autocomplete,
  CircularProgress,
  Snackbar,
  InputAdornment,
  Avatar,
  Stack,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MovieIcon from '@mui/icons-material/Movie'
import VisibilityIcon from '@mui/icons-material/Visibility'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { getProxiedImageUrl } from '@aperture/ui'

interface Channel {
  id: string
  name: string
  description: string | null
  genre_filters: string[]
  text_preferences: string | null
  example_movie_ids: string[]
  is_pinned_row: boolean
  is_active: boolean
  playlist_id: string | null
  last_generated_at: string | null
}

interface Movie {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  provider_item_id?: string
}

interface PlaylistItem {
  id: string
  playlistItemId: string
  title: string
  year: number | null
  posterUrl: string | null
  runtime: number | null
}

interface FormData {
  name: string
  description: string
  genreFilters: string[]
  textPreferences: string
  exampleMovies: Movie[]
}

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    genreFilters: [],
    textPreferences: '',
    exampleMovies: [],
  })

  // Genres state
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [loadingGenres, setLoadingGenres] = useState(false)

  // Movie search state
  const [movieSearch, setMovieSearch] = useState('')
  const [movieSearchResults, setMovieSearchResults] = useState<Movie[]>([])
  const [searchingMovies, setSearchingMovies] = useState(false)

  // Generation state
  const [generatingChannelId, setGeneratingChannelId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Playlist view/edit state
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false)
  const [viewingChannel, setViewingChannel] = useState<Channel | null>(null)
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [loadingPlaylist, setLoadingPlaylist] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [addMovieSearch, setAddMovieSearch] = useState('')
  const [addMovieResults, setAddMovieResults] = useState<Movie[]>([])
  const [searchingAddMovies, setSearchingAddMovies] = useState(false)
  const [addingMovieId, setAddingMovieId] = useState<string | null>(null)

  // AI generation state
  const [generatingAIPreferences, setGeneratingAIPreferences] = useState(false)
  const [generatingAIName, setGeneratingAIName] = useState(false)
  const [generatingAIDescription, setGeneratingAIDescription] = useState(false)

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels)
        setError(null)
      } else {
        setError('Failed to load channels')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  const fetchGenres = async () => {
    setLoadingGenres(true)
    try {
      const response = await fetch('/api/genres', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAvailableGenres(data.genres)
      }
    } catch {
      console.error('Failed to fetch genres')
    } finally {
      setLoadingGenres(false)
    }
  }

  // Debounced movie search
  const searchMovies = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setMovieSearchResults([])
      return
    }

    setSearchingMovies(true)
    try {
      const response = await fetch(`/api/movies?search=${encodeURIComponent(query)}&pageSize=10`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMovieSearchResults(data.movies)
      }
    } catch {
      console.error('Failed to search movies')
    } finally {
      setSearchingMovies(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchGenres()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMovies(movieSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [movieSearch, searchMovies])

  const fetchExampleMovies = async (movieIds: string[]): Promise<Movie[]> => {
    if (movieIds.length === 0) return []

    const movies: Movie[] = []
    for (const id of movieIds) {
      try {
        const response = await fetch(`/api/movies/${id}`, { credentials: 'include' })
        if (response.ok) {
          const movie = await response.json()
          movies.push({
            id: movie.id,
            title: movie.title,
            year: movie.year,
            poster_url: movie.poster_url,
          })
        }
      } catch {
        // Skip failed movie fetches
      }
    }
    return movies
  }

  const handleOpenDialog = async (channel?: Channel) => {
    if (channel) {
      setEditingChannel(channel)
      // Fetch example movie details
      const exampleMovies = await fetchExampleMovies(channel.example_movie_ids || [])
      setFormData({
        name: channel.name,
        description: channel.description || '',
        genreFilters: channel.genre_filters || [],
        textPreferences: channel.text_preferences || '',
        exampleMovies,
      })
    } else {
      setEditingChannel(null)
      setFormData({
        name: '',
        description: '',
        genreFilters: [],
        textPreferences: '',
        exampleMovies: [],
      })
    }
    setMovieSearch('')
    setMovieSearchResults([])
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingChannel(null)
    setFormData({
      name: '',
      description: '',
      genreFilters: [],
      textPreferences: '',
      exampleMovies: [],
    })
    setMovieSearch('')
    setMovieSearchResults([])
  }

  const handleSubmit = async () => {
    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      genreFilters: formData.genreFilters,
      textPreferences: formData.textPreferences || undefined,
      exampleMovieIds: formData.exampleMovies.map((m) => m.id),
    }

    try {
      const url = editingChannel ? `/api/channels/${editingChannel.id}` : '/api/channels'
      const method = editingChannel ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        handleCloseDialog()
        fetchChannels()
        setSnackbar({
          open: true,
          message: editingChannel ? 'Channel updated' : 'Channel created',
          severity: 'success',
        })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to save channel', severity: 'error' })
    }
  }

  const handleDelete = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return

    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        fetchChannels()
        setSnackbar({ open: true, message: 'Channel deleted', severity: 'success' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete channel', severity: 'error' })
    }
  }

  const handleGeneratePlaylist = async (channelId: string) => {
    setGeneratingChannelId(channelId)
    try {
      const response = await fetch(`/api/channels/${channelId}/generate`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        fetchChannels()
        setSnackbar({
          open: true,
          message: `Playlist created with ${data.itemCount} movies`,
          severity: 'success',
        })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate playlist', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate playlist', severity: 'error' })
    } finally {
      setGeneratingChannelId(null)
    }
  }

  const addExampleMovie = (movie: Movie) => {
    if (!formData.exampleMovies.find((m) => m.id === movie.id)) {
      setFormData({
        ...formData,
        exampleMovies: [...formData.exampleMovies, movie],
      })
    }
    setMovieSearch('')
    setMovieSearchResults([])
  }

  const removeExampleMovie = (movieId: string) => {
    setFormData({
      ...formData,
      exampleMovies: formData.exampleMovies.filter((m) => m.id !== movieId),
    })
  }

  // Playlist view/edit functions
  const handleViewPlaylist = async (channel: Channel) => {
    setViewingChannel(channel)
    setPlaylistDialogOpen(true)
    setLoadingPlaylist(true)
    setPlaylistItems([])
    setAddMovieSearch('')
    setAddMovieResults([])

    try {
      const response = await fetch(`/api/channels/${channel.id}/items`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPlaylistItems(data.items || [])
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to load playlist', severity: 'error' })
    } finally {
      setLoadingPlaylist(false)
    }
  }

  const handleClosePlaylistDialog = () => {
    setPlaylistDialogOpen(false)
    setViewingChannel(null)
    setPlaylistItems([])
    setAddMovieSearch('')
    setAddMovieResults([])
  }

  const handleRemoveFromPlaylist = async (entryId: string) => {
    if (!viewingChannel) return

    setRemovingItemId(entryId)
    try {
      const response = await fetch(`/api/channels/${viewingChannel.id}/items/${entryId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        setPlaylistItems(playlistItems.filter((item) => item.playlistItemId !== entryId))
        setSnackbar({ open: true, message: 'Movie removed from playlist', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to remove movie', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove movie', severity: 'error' })
    } finally {
      setRemovingItemId(null)
    }
  }

  // Search for movies to add to playlist
  const searchAddMovies = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setAddMovieResults([])
      return
    }

    setSearchingAddMovies(true)
    try {
      const response = await fetch(`/api/movies?search=${encodeURIComponent(query)}&pageSize=10`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setAddMovieResults(data.movies)
      }
    } catch {
      console.error('Failed to search movies')
    } finally {
      setSearchingAddMovies(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (playlistDialogOpen) {
        searchAddMovies(addMovieSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [addMovieSearch, searchAddMovies, playlistDialogOpen])

  const handleAddToPlaylist = async (movie: Movie) => {
    if (!viewingChannel || !movie.provider_item_id) return

    setAddingMovieId(movie.id)
    try {
      const response = await fetch(`/api/channels/${viewingChannel.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemIds: [movie.provider_item_id] }),
      })

      if (response.ok) {
        // Refresh the playlist items
        const itemsResponse = await fetch(`/api/channels/${viewingChannel.id}/items`, { credentials: 'include' })
        if (itemsResponse.ok) {
          const data = await itemsResponse.json()
          setPlaylistItems(data.items || [])
        }
        setSnackbar({ open: true, message: `Added "${movie.title}" to playlist`, severity: 'success' })
        setAddMovieSearch('')
        setAddMovieResults([])
      } else {
        setSnackbar({ open: true, message: 'Failed to add movie', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to add movie', severity: 'error' })
    } finally {
      setAddingMovieId(null)
    }
  }

  // Generate AI-powered text preferences
  const handleGenerateAIPreferences = async () => {
    if (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingAIPreferences(true)
    try {
      const response = await fetch('/api/channels/ai-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData({ ...formData, textPreferences: data.preferences })
        setSnackbar({ open: true, message: 'AI preferences generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate preferences', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate preferences', severity: 'error' })
    } finally {
      setGeneratingAIPreferences(false)
    }
  }

  // Generate AI-powered playlist name
  const handleGenerateAIName = async () => {
    if (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingAIName(true)
    try {
      const response = await fetch('/api/channels/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
          textPreferences: formData.textPreferences || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData({ ...formData, name: data.name })
        setSnackbar({ open: true, message: 'AI name generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate name', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate name', severity: 'error' })
    } finally {
      setGeneratingAIName(false)
    }
  }

  // Generate AI-powered playlist description
  const handleGenerateAIDescription = async () => {
    if (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingAIDescription(true)
    try {
      const response = await fetch('/api/channels/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
          textPreferences: formData.textPreferences || undefined,
          playlistName: formData.name || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData({ ...formData, description: data.description })
        setSnackbar({ open: true, message: 'AI description generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate description', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate description', severity: 'error' })
    } finally {
      setGeneratingAIDescription(false)
    }
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          Channels
        </Typography>
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={1}>
            Channels
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create custom recommendation playlists with genres and example movies
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          New Channel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {channels.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 2,
            textAlign: 'center',
            py: 6,
          }}
        >
          <PlaylistPlayIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" mb={1}>
            No channels yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first channel to get custom recommendation playlists
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Create Channel
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {channels.map((channel) => (
            <Grid item xs={12} sm={6} md={4} key={channel.id}>
              <Card
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                      {channel.name}
                    </Typography>
                    {channel.playlist_id && (
                      <Tooltip title="Playlist synced">
                        <CheckCircleIcon color="success" fontSize="small" />
                      </Tooltip>
                    )}
                  </Box>

                  {channel.description && (
                    <Typography variant="body2" color="text.secondary" mb={2} sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {channel.description}
                    </Typography>
                  )}

                  {channel.genre_filters && channel.genre_filters.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Genres
                      </Typography>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {channel.genre_filters.slice(0, 4).map((genre) => (
                          <Chip key={genre} label={genre} size="small" variant="outlined" />
                        ))}
                        {channel.genre_filters.length > 4 && (
                          <Chip label={`+${channel.genre_filters.length - 4}`} size="small" />
                        )}
                      </Box>
                    </Box>
                  )}

                  {channel.example_movie_ids && channel.example_movie_ids.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        {channel.example_movie_ids.length} example movie{channel.example_movie_ids.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    {channel.last_generated_at ? (
                      <Typography variant="caption" color="text.secondary">
                        Updated: {new Date(channel.last_generated_at).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="warning.main">
                        Not generated yet
                      </Typography>
                    )}
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={generatingChannelId === channel.id ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                      onClick={() => handleGeneratePlaylist(channel.id)}
                      disabled={generatingChannelId === channel.id}
                    >
                      {channel.playlist_id ? 'Refresh' : 'Generate'}
                    </Button>
                    {channel.playlist_id && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewPlaylist(channel)}
                      >
                        View
                      </Button>
                    )}
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => handleOpenDialog(channel)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(channel.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChannel ? 'Edit Playlist' : 'New Playlist'}</DialogTitle>
        <DialogContent>
          {/* Step 1: Genre Multi-Select */}
          <Box mt={1}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              1. Select Genres
            </Typography>
            <Autocomplete
              multiple
              filterSelectedOptions
              options={availableGenres}
              value={formData.genreFilters}
              onChange={(_, newValue) => setFormData({ ...formData, genreFilters: newValue })}
              loading={loadingGenres}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={formData.genreFilters.length === 0 ? 'Select genres...' : ''}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingGenres ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} />
                ))
              }
            />
          </Box>

          {/* Step 2: Example Movies */}
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              2. Add Example Movies
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Movies that define this playlist's vibe
            </Typography>

            {/* Movie Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search for movies..."
              value={movieSearch}
              onChange={(e) => setMovieSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchingMovies ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : null,
              }}
            />

            {/* Search Results */}
            {movieSearchResults.length > 0 && (
              <Box
                sx={{
                  mt: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {movieSearchResults.map((movie) => (
                  <Box
                    key={movie.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                    onClick={() => addExampleMovie(movie)}
                  >
                    <Avatar src={getProxiedImageUrl(movie.poster_url)} variant="rounded" sx={{ width: 32, height: 48 }}>
                      <MovieIcon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{movie.title}</Typography>
                      {movie.year && (
                        <Typography variant="caption" color="text.secondary">
                          {movie.year}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Selected Movies */}
            {formData.exampleMovies.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                {formData.exampleMovies.map((movie) => (
                  <Chip
                    key={movie.id}
                    avatar={
                      <Avatar src={getProxiedImageUrl(movie.poster_url)}>
                        <MovieIcon fontSize="small" />
                      </Avatar>
                    }
                    label={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`}
                    onDelete={() => removeExampleMovie(movie.id)}
                    deleteIcon={<CloseIcon />}
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Step 3: Text Preferences */}
          <Box mt={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Typography variant="subtitle2" color="primary">
                3. Text Preferences (Optional)
              </Typography>
              <Tooltip title="Generate AI preferences based on your taste profile, genres, and example movies">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleGenerateAIPreferences}
                    disabled={generatingAIPreferences || (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0)}
                    sx={{
                      '&:hover': { backgroundColor: 'primary.main', color: 'white' },
                    }}
                  >
                    {generatingAIPreferences ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <AutoAwesomeIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={formData.textPreferences}
              onChange={(e) => setFormData({ ...formData, textPreferences: e.target.value })}
              placeholder="e.g., Dark atmosphere, morally complex characters, twist endings..."
              helperText="Describe what you want. Click ✨ to auto-generate."
            />
          </Box>

          {/* Step 4: Name */}
          <Box mt={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Typography variant="subtitle2" color="primary">
                4. Playlist Name
              </Typography>
              <Tooltip title="Generate a creative name based on genres, movies, and preferences">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleGenerateAIName}
                    disabled={generatingAIName || (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0)}
                    sx={{
                      '&:hover': { backgroundColor: 'primary.main', color: 'white' },
                    }}
                  >
                    {generatingAIName ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <AutoAwesomeIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Neon Noir Nights"
              helperText="A catchy name for your playlist. Click ✨ to auto-generate."
            />
          </Box>

          {/* Step 5: Description */}
          <Box mt={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Typography variant="subtitle2" color="primary">
                5. Description (Optional)
              </Typography>
              <Tooltip title="Generate a description based on your playlist">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleGenerateAIDescription}
                    disabled={generatingAIDescription || (formData.genreFilters.length === 0 && formData.exampleMovies.length === 0)}
                    sx={{
                      '&:hover': { backgroundColor: 'primary.main', color: 'white' },
                    }}
                  >
                    {generatingAIDescription ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <AutoAwesomeIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="A curated collection of..."
              helperText="Brief description for your playlist. Click ✨ to auto-generate."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!formData.name}>
            {editingChannel ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Playlist View/Edit Dialog */}
      <Dialog open={playlistDialogOpen} onClose={handleClosePlaylistDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">{viewingChannel?.name} - Playlist</Typography>
              <Typography variant="body2" color="text.secondary">
                {playlistItems.length} movies
              </Typography>
            </Box>
            <IconButton onClick={handleClosePlaylistDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* Add Movie Search */}
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              Add Movie to Playlist
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search for movies to add..."
              value={addMovieSearch}
              onChange={(e) => setAddMovieSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchingAddMovies ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : null,
              }}
            />

            {/* Search Results */}
            {addMovieResults.length > 0 && (
              <Box
                sx={{
                  mt: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {addMovieResults
                  .filter((movie) => !playlistItems.some((item) => item.id === movie.provider_item_id))
                  .map((movie) => (
                    <Box
                      key={movie.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        cursor: addingMovieId === movie.id ? 'wait' : 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                        opacity: addingMovieId === movie.id ? 0.5 : 1,
                      }}
                      onClick={() => addingMovieId !== movie.id && handleAddToPlaylist(movie)}
                    >
                      <Avatar src={getProxiedImageUrl(movie.poster_url)} variant="rounded" sx={{ width: 32, height: 48 }}>
                        <MovieIcon fontSize="small" />
                      </Avatar>
                      <Box flexGrow={1}>
                        <Typography variant="body2">{movie.title}</Typography>
                        {movie.year && (
                          <Typography variant="caption" color="text.secondary">
                            {movie.year}
                          </Typography>
                        )}
                      </Box>
                      {addingMovieId === movie.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <IconButton size="small" color="primary">
                          <AddIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                {addMovieResults.length > 0 &&
                  addMovieResults.filter((movie) => !playlistItems.some((item) => item.id === movie.provider_item_id)).length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      All results are already in playlist
                    </Typography>
                  )}
              </Box>
            )}
          </Box>

          {/* Playlist Items */}
          {loadingPlaylist ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : playlistItems.length === 0 ? (
            <Box textAlign="center" py={4}>
              <PlaylistPlayIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No movies in playlist yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Generate the playlist or add movies manually
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {playlistItems.map((item, index) => (
                <Box
                  key={item.playlistItemId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.5,
                    px: 1,
                    borderBottom: index < playlistItems.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24 }}>
                    {index + 1}
                  </Typography>
                  {item.posterUrl ? (
                    <Avatar src={item.posterUrl} variant="rounded" sx={{ width: 40, height: 60 }} />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 40, height: 60 }}>
                      <MovieIcon />
                    </Avatar>
                  )}
                  <Box flexGrow={1}>
                    <Typography variant="body1">{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.year || 'Unknown year'}
                      {item.runtime && ` • ${item.runtime} min`}
                    </Typography>
                  </Box>
                  <Tooltip title="Remove from playlist">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveFromPlaylist(item.playlistItemId)}
                      disabled={removingItemId === item.playlistItemId}
                    >
                      {removingItemId === item.playlistItemId ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <RemoveCircleOutlineIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePlaylistDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
