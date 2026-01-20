import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
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
  Tooltip,
  Button,
  alpha,
  useTheme,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import MovieIcon from '@mui/icons-material/Movie'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import CategoryIcon from '@mui/icons-material/Category'
import TuneIcon from '@mui/icons-material/Tune'
import TitleIcon from '@mui/icons-material/Title'
import DescriptionIcon from '@mui/icons-material/Description'
import AddIcon from '@mui/icons-material/Add'
import { getProxiedImageUrl } from '@aperture/ui'
import type { Channel, Movie, FormData, SnackbarState } from '../types'
import type { Theme } from '@mui/material'

// AI button component - defined outside to prevent re-renders
function AIButton({
  onClick,
  loading,
  disabled,
  tooltip,
  theme,
}: {
  onClick: () => void
  loading: boolean
  disabled: boolean
  tooltip: string
  theme: Theme
}) {
  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={loading || disabled}
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.main',
              color: 'white',
            },
            '&.Mui-disabled': {
              bgcolor: alpha(theme.palette.action.disabled, 0.1),
            },
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <AutoAwesomeIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  )
}

// Section wrapper component - defined outside to prevent re-renders
function Section({
  icon,
  title,
  subtitle,
  children,
  aiButton,
  theme,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  aiButton?: React.ReactNode
  theme: Theme
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.default, 0.5),
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
      }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {aiButton}
      </Box>
      {children}
    </Box>
  )
}

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
  const theme = useTheme()

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Gradient Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlaylistPlayIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {editingChannel ? 'Edit Playlist' : 'New Playlist'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editingChannel
                ? 'Update your playlist settings'
                : 'Create a personalized recommendation playlist'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Genres Section */}
        <Section
          icon={<CategoryIcon fontSize="small" />}
          title="Genres"
          subtitle="Select genres to match"
          theme={theme}
        >
          <Autocomplete
            multiple
            filterSelectedOptions
            options={availableGenres}
            value={formData.genreFilters}
            onChange={(_, newValue) => setFormData({ ...formData, genreFilters: newValue })}
            loading={loadingGenres}
            size="small"
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={formData.genreFilters.length === 0 ? 'Search genres...' : ''}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingGenres ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="filled"
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                  key={option}
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15) }}
                />
              ))
            }
          />
        </Section>

        {/* Example Movies Section */}
        <Section
          icon={<MovieIcon fontSize="small" />}
          title="Seed Movies"
          subtitle="Movies that define this playlist's vibe"
          theme={theme}
        >
          {/* Movie Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search for movies to add..."
            value={movieSearch}
            onChange={(e) => setMovieSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
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
                maxHeight: 180,
                overflow: 'auto',
                borderRadius: 1,
                bgcolor: 'background.default',
              }}
            >
              {movieSearchResults.map((movie) => (
                <Box
                  key={movie.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    cursor: 'pointer',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => handleAddMovie(movie)}
                >
                  <Avatar
                    src={getProxiedImageUrl(movie.poster_url)}
                    variant="rounded"
                    sx={{ width: 36, height: 54 }}
                  >
                    <MovieIcon fontSize="small" />
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={500}>
                      {movie.title}
                    </Typography>
                    {movie.year && (
                      <Typography variant="caption" color="text.secondary">
                        {movie.year}
                      </Typography>
                    )}
                  </Box>
                  <IconButton size="small" color="primary">
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {/* Selected Movies - Visual Strip */}
          {formData.exampleMovies.length > 0 && (
            <Box
              sx={{
                mt: 2,
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                pb: 1,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: alpha(theme.palette.text.primary, 0.2),
                  borderRadius: 2,
                },
              }}
            >
              {formData.exampleMovies.map((movie) => (
                <Tooltip key={movie.id} title={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`}>
                  <Box
                    sx={{
                      position: 'relative',
                      flexShrink: 0,
                      width: 52,
                      height: 78,
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      '&:hover .remove-btn': { opacity: 1 },
                    }}
                    onClick={() => onRemoveExampleMovie(movie.id)}
                  >
                    {movie.poster_url ? (
                      <img
                        src={getProxiedImageUrl(movie.poster_url)}
                        alt={movie.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          bgcolor: 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MovieIcon sx={{ color: 'text.disabled' }} />
                      </Box>
                    )}
                    <Box
                      className="remove-btn"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <CloseIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          )}
        </Section>

        {/* Text Preferences Section */}
        <Section
          icon={<TuneIcon fontSize="small" />}
          title="Preferences"
          subtitle="Describe your ideal recommendations"
          theme={theme}
          aiButton={
            <AIButton
              onClick={handleGenerateAIPreferences}
              loading={generatingAIPreferences}
              disabled={!canGenerate}
              tooltip="Generate preferences with AI based on genres & movies"
              theme={theme}
            />
          }
        >
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            value={formData.textPreferences}
            onChange={(e) => setFormData({ ...formData, textPreferences: e.target.value })}
            placeholder="e.g., Dark atmosphere, morally complex characters, twist endings..."
          />
        </Section>

        {/* Name Section */}
        <Section
          icon={<TitleIcon fontSize="small" />}
          title="Playlist Name"
          theme={theme}
          aiButton={
            <AIButton
              onClick={handleGenerateAIName}
              loading={generatingAIName}
              disabled={!canGenerate}
              tooltip="Generate a creative name with AI"
              theme={theme}
            />
          }
        >
          <TextField
            fullWidth
            size="small"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Neon Noir Nights"
          />
        </Section>

        {/* Description Section */}
        <Section
          icon={<DescriptionIcon fontSize="small" />}
          title="Description"
          subtitle="Optional"
          theme={theme}
          aiButton={
            <AIButton
              onClick={handleGenerateAIDescription}
              loading={generatingAIDescription}
              disabled={!canGenerate}
              tooltip="Generate a description with AI"
              theme={theme}
            />
          }
        >
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="A curated collection of..."
          />
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!formData.name}
          startIcon={<PlaylistPlayIcon />}
        >
          {editingChannel ? 'Save Changes' : 'Create Playlist'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
