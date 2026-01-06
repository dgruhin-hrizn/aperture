import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  InputAdornment,
  Avatar,
  Tooltip,
  Button,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import MovieIcon from '@mui/icons-material/Movie'
import AddIcon from '@mui/icons-material/Add'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import type { Channel, Movie, PlaylistItem } from '../types'

interface PlaylistViewDialogProps {
  open: boolean
  channel: Channel | null
  playlistItems: PlaylistItem[]
  loadingPlaylist: boolean
  removingItemId: string | null
  addingMovieId: string | null
  onClose: () => void
  onRemoveItem: (entryId: string) => void
  onAddMovie: (movie: Movie) => void
}

export function PlaylistViewDialog({
  open,
  channel,
  playlistItems,
  loadingPlaylist,
  removingItemId,
  addingMovieId,
  onClose,
  onRemoveItem,
  onAddMovie,
}: PlaylistViewDialogProps) {
  const [addMovieSearch, setAddMovieSearch] = useState('')
  const [addMovieResults, setAddMovieResults] = useState<Movie[]>([])
  const [searchingAddMovies, setSearchingAddMovies] = useState(false)

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
      if (open) {
        searchAddMovies(addMovieSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [addMovieSearch, searchAddMovies, open])

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setAddMovieSearch('')
      setAddMovieResults([])
    }
  }, [open])

  const handleAddMovie = (movie: Movie) => {
    onAddMovie(movie)
    setAddMovieSearch('')
    setAddMovieResults([])
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">{channel?.name} - Playlist</Typography>
            <Typography variant="body2" color="text.secondary">
              {playlistItems.length} movies
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
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
                    onClick={() => addingMovieId !== movie.id && handleAddMovie(movie)}
                  >
                    {movie.poster_url ? (
                      <Avatar src={movie.poster_url} variant="rounded" sx={{ width: 32, height: 48 }} />
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 32, height: 48 }}>
                        <MovieIcon fontSize="small" />
                      </Avatar>
                    )}
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
                    onClick={() => onRemoveItem(item.playlistItemId)}
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
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}


