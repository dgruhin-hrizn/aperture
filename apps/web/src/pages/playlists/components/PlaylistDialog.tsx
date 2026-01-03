import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Chip,
  IconButton,
  Autocomplete,
  CircularProgress,
  InputAdornment,
  Avatar,
  Stack,
  Tooltip,
  Button,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import MovieIcon from '@mui/icons-material/Movie'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { Channel, Movie, FormData, SnackbarState } from '../types'

interface PlaylistDialogProps {
  open: boolean
  editingChannel: Channel | null
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  availableGenres: string[]
  loadingGenres: boolean
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>
  onClose: () => void
  onSubmit: () => void
  onAddExampleMovie: (movie: Movie) => void
  onRemoveExampleMovie: (movieId: string) => void
}

export function PlaylistDialog({
  open,
  editingChannel,
  formData,
  setFormData,
  availableGenres,
  loadingGenres,
  setSnackbar,
  onClose,
  onSubmit,
  onAddExampleMovie,
  onRemoveExampleMovie,
}: PlaylistDialogProps) {
  // Movie search state
  const [movieSearch, setMovieSearch] = useState('')
  const [movieSearchResults, setMovieSearchResults] = useState<Movie[]>([])
  const [searchingMovies, setSearchingMovies] = useState(false)

  // AI generation state
  const [generatingAIPreferences, setGeneratingAIPreferences] = useState(false)
  const [generatingAIName, setGeneratingAIName] = useState(false)
  const [generatingAIDescription, setGeneratingAIDescription] = useState(false)

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
    const timer = setTimeout(() => {
      searchMovies(movieSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [movieSearch, searchMovies])

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setMovieSearch('')
      setMovieSearchResults([])
    }
  }, [open])

  const handleAddMovie = (movie: Movie) => {
    onAddExampleMovie(movie)
    setMovieSearch('')
    setMovieSearchResults([])
  }

  const canGenerate = formData.genreFilters.length > 0 || formData.exampleMovies.length > 0

  // Generate AI-powered text preferences
  const handleGenerateAIPreferences = async () => {
    if (!canGenerate) {
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
    if (!canGenerate) {
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
    if (!canGenerate) {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
                  onClick={() => handleAddMovie(movie)}
                >
                  {movie.poster_url ? (
                    <Avatar src={movie.poster_url} variant="rounded" sx={{ width: 32, height: 48 }} />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 32, height: 48 }}>
                      <MovieIcon fontSize="small" />
                    </Avatar>
                  )}
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
                    movie.poster_url ? (
                      <Avatar src={movie.poster_url} />
                    ) : (
                      <Avatar>
                        <MovieIcon fontSize="small" />
                      </Avatar>
                    )
                  }
                  label={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`}
                  onDelete={() => onRemoveExampleMovie(movie.id)}
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
                  disabled={generatingAIPreferences || !canGenerate}
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
                  disabled={generatingAIName || !canGenerate}
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
                  disabled={generatingAIDescription || !canGenerate}
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!formData.name}>
          {editingChannel ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

