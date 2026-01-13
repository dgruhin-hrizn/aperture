import { useState, useEffect, useCallback } from 'react'
import type { Channel, Movie, PlaylistItem, FormData, SnackbarState, GraphPlaylist } from '../types'

const initialFormData: FormData = {
  name: '',
  description: '',
  genreFilters: [],
  textPreferences: '',
  exampleMovies: [],
}

export function usePlaylistsData() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [graphPlaylists, setGraphPlaylists] = useState<GraphPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)

  // Genres state
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [loadingGenres, setLoadingGenres] = useState(false)

  // Generation state
  const [generatingChannelId, setGeneratingChannelId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<SnackbarState>({
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
  const [addingMovieId, setAddingMovieId] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPlaylist, setDeletingPlaylist] = useState<{ id: string; name: string; type: 'channel' | 'graph' } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels)
        setError(null)
      } else {
        setError('Failed to load playlists')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  const fetchGraphPlaylists = useCallback(async () => {
    try {
      const response = await fetch('/api/graph-playlists', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setGraphPlaylists(data.playlists || [])
      }
    } catch {
      // Silent fail - graph playlists are optional
      console.error('Failed to fetch graph playlists')
    }
  }, [])

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

  useEffect(() => {
    fetchChannels()
    fetchGenres()
    fetchGraphPlaylists()
  }, [fetchGraphPlaylists])

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
      setFormData(initialFormData)
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingChannel(null)
    setFormData(initialFormData)
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
          message: editingChannel ? 'Playlist updated' : 'Playlist created',
          severity: 'success',
        })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to save playlist', severity: 'error' })
    }
  }

  // Open delete confirmation dialog
  const handleDeleteClick = (id: string, name: string, type: 'channel' | 'graph') => {
    setDeletingPlaylist({ id, name, type })
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setDeletingPlaylist(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPlaylist) return

    setDeleteLoading(true)
    try {
      const url = deletingPlaylist.type === 'channel'
        ? `/api/channels/${deletingPlaylist.id}`
        : `/api/graph-playlists/${deletingPlaylist.id}`

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        if (deletingPlaylist.type === 'channel') {
          fetchChannels()
        } else {
          fetchGraphPlaylists()
        }
        setSnackbar({ open: true, message: 'Playlist deleted', severity: 'success' })
        setDeleteDialogOpen(false)
        setDeletingPlaylist(null)
      } else {
        setSnackbar({ open: true, message: 'Failed to delete playlist', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete playlist', severity: 'error' })
    } finally {
      setDeleteLoading(false)
    }
  }

  // Legacy functions that now use the dialog
  const handleDelete = (channelId: string, channelName: string) => {
    handleDeleteClick(channelId, channelName, 'channel')
  }

  const handleDeleteGraphPlaylist = (playlistId: string, playlistName: string) => {
    handleDeleteClick(playlistId, playlistName, 'graph')
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
        const itemsResponse = await fetch(`/api/channels/${viewingChannel.id}/items`, {
          credentials: 'include',
        })
        if (itemsResponse.ok) {
          const data = await itemsResponse.json()
          setPlaylistItems(data.items || [])
        }
        setSnackbar({
          open: true,
          message: `Added "${movie.title}" to playlist`,
          severity: 'success',
        })
      } else {
        setSnackbar({ open: true, message: 'Failed to add movie', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to add movie', severity: 'error' })
    } finally {
      setAddingMovieId(null)
    }
  }

  return {
    // Data
    channels,
    graphPlaylists,
    loading,
    error,
    availableGenres,
    loadingGenres,
    formData,
    setFormData,
    editingChannel,
    generatingChannelId,
    snackbar,
    setSnackbar,
    // Dialog state
    dialogOpen,
    playlistDialogOpen,
    viewingChannel,
    playlistItems,
    loadingPlaylist,
    removingItemId,
    addingMovieId,
    // Delete confirmation dialog state
    deleteDialogOpen,
    deletingPlaylist,
    deleteLoading,
    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSubmit,
    handleDelete,
    handleDeleteGraphPlaylist,
    handleDeleteCancel,
    handleDeleteConfirm,
    handleGeneratePlaylist,
    addExampleMovie,
    removeExampleMovie,
    handleViewPlaylist,
    handleClosePlaylistDialog,
    handleRemoveFromPlaylist,
    handleAddToPlaylist,
  }
}
