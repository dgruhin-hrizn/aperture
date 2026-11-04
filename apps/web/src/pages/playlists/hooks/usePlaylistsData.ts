import { useAuth } from '../../../hooks/useAuth'
import { apiFetch } from '../../../lib/api'
import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Channel,
  Movie,
  PlaylistItem,
  FormData,
  SnackbarState,
  GraphPlaylist,
  GraphPlaylistItem,
} from '../types'

const initialFormData: FormData = {
  name: '',
  description: '',
  genreFilters: [],
  textPreferences: '',
  exampleMovies: [],
}

export function usePlaylistsData() {
  const userId = useAuth().user?.id
  const activeUser = useRef(userId)
  activeUser.current = userId
  const viewRequest = useRef<AbortController | null>(null)
  const editorRequest = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      viewRequest.current?.abort()
      editorRequest.current?.abort()
    },
    [userId]
  )
  const [channels, setChannels] = useState<Channel[]>([])
  const [graphPlaylists, setGraphPlaylists] = useState<GraphPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGraph, setLoadingGraph] = useState(true)
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

  // Graph playlist view state
  const [graphPlaylistDialogOpen, setGraphPlaylistDialogOpen] = useState(false)
  const [viewingGraphPlaylist, setViewingGraphPlaylist] = useState<GraphPlaylist | null>(null)
  const [graphPlaylistItems, setGraphPlaylistItems] = useState<GraphPlaylistItem[]>([])
  const [loadingGraphPlaylist, setLoadingGraphPlaylist] = useState(false)

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPlaylist, setDeletingPlaylist] = useState<{
    id: string
    name: string
    type: 'channel' | 'graph'
  } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchChannels = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await apiFetch('/api/channels', { signal })
        if (response.ok) {
          const data = await response.json()
          if (signal?.aborted || activeUser.current !== userId) return
          setChannels(data.channels)
          setError(null)
        } else {
          setError('Failed to load playlists')
        }
      } catch {
        if (signal?.aborted || activeUser.current !== userId) return
        setError('Could not connect to server')
      } finally {
        if (!signal?.aborted && activeUser.current === userId) setLoading(false)
      }
    },
    [userId]
  )

  const fetchGraphPlaylists = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await apiFetch('/api/graph-playlists', { signal })
        if (response.ok) {
          const data = await response.json()
          if (signal?.aborted || activeUser.current !== userId) return
          setGraphPlaylists(data.playlists || [])
        }
      } catch {
        if (signal?.aborted || activeUser.current !== userId) return
        // Silent fail - graph playlists are optional
        console.error('Failed to fetch graph playlists')
      } finally {
        if (!signal?.aborted && activeUser.current === userId) setLoadingGraph(false)
      }
    },
    [userId]
  )

  const fetchGenres = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingGenres(true)
      try {
        const response = await apiFetch('/api/genres', { signal })
        if (response.ok) {
          const data = await response.json()
          if (signal?.aborted || activeUser.current !== userId) return
          setAvailableGenres(data.genres)
        }
      } catch {
        if (signal?.aborted || activeUser.current !== userId) return
        console.error('Failed to fetch genres')
      } finally {
        if (!signal?.aborted && activeUser.current === userId) setLoadingGenres(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    const controller = new AbortController()
    setChannels([])
    setGraphPlaylists([])
    setDialogOpen(false)
    setPlaylistDialogOpen(false)
    setGraphPlaylistDialogOpen(false)
    setLoading(true)
    setLoadingGraph(true)
    setError(null)
    if (!userId) {
      setLoading(false)
      setLoadingGraph(false)
      return
    }
    void fetchChannels(controller.signal)
    void fetchGraphPlaylists(controller.signal)
    return () => controller.abort()
  }, [userId, fetchChannels, fetchGraphPlaylists])

  useEffect(() => {
    if (!dialogOpen) return
    const controller = new AbortController()
    void fetchGenres(controller.signal)
    return () => controller.abort()
  }, [dialogOpen, fetchGenres])

  const fetchExampleMovies = async (movieIds: string[], signal: AbortSignal): Promise<Movie[]> => {
    if (movieIds.length === 0) return []

    const response = await apiFetch(`/api/movies/summaries?ids=${movieIds.join(',')}`, { signal })
    if (!response.ok) return []
    const data = (await response.json()) as { movies: Movie[] }
    return data.movies
  }

  const handleOpenDialog = async (channel?: Channel) => {
    editorRequest.current?.abort()
    const controller = new AbortController()
    editorRequest.current = controller
    if (channel) {
      setEditingChannel(channel)
      // Fetch example movie details
      const exampleMovies = await fetchExampleMovies(
        channel.example_movie_ids || [],
        controller.signal
      ).catch(() => [])
      if (controller.signal.aborted || activeUser.current !== userId) return
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
    editorRequest.current?.abort()
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
        window.dispatchEvent(new Event('aperture:playlist-changed'))
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
      const url =
        deletingPlaylist.type === 'channel'
          ? `/api/channels/${deletingPlaylist.id}`
          : `/api/graph-playlists/${deletingPlaylist.id}`

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        window.dispatchEvent(new Event('aperture:playlist-changed'))
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
        window.dispatchEvent(new Event('aperture:playlist-changed'))
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
    viewRequest.current?.abort()
    const controller = new AbortController()
    viewRequest.current = controller
    setViewingChannel(channel)
    setPlaylistDialogOpen(true)
    setLoadingPlaylist(true)
    setPlaylistItems([])

    try {
      const response = await apiFetch(`/api/channels/${channel.id}/items`, {
        signal: controller.signal,
      })
      if (response.ok) {
        const data = await response.json()
        if (controller.signal.aborted || activeUser.current !== userId) return
        setPlaylistItems(data.items || [])
      }
    } catch {
      if (controller.signal.aborted) return
      setSnackbar({ open: true, message: 'Failed to load playlist', severity: 'error' })
    } finally {
      if (!controller.signal.aborted) setLoadingPlaylist(false)
    }
  }

  const handleClosePlaylistDialog = () => {
    viewRequest.current?.abort()
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
        window.dispatchEvent(new Event('aperture:playlist-changed'))
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
        window.dispatchEvent(new Event('aperture:playlist-changed'))
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

  // Graph playlist view functions
  const handleViewGraphPlaylist = async (playlist: GraphPlaylist) => {
    viewRequest.current?.abort()
    const controller = new AbortController()
    viewRequest.current = controller
    setViewingGraphPlaylist(playlist)
    setGraphPlaylistDialogOpen(true)
    setLoadingGraphPlaylist(true)
    setGraphPlaylistItems([])

    try {
      const response = await apiFetch(`/api/graph-playlists/${playlist.id}/items`, {
        signal: controller.signal,
      })
      if (response.ok) {
        const data = await response.json()
        if (controller.signal.aborted || activeUser.current !== userId) return
        setGraphPlaylistItems(data.items || [])
      }
    } catch {
      if (controller.signal.aborted) return
      setSnackbar({ open: true, message: 'Failed to load playlist', severity: 'error' })
    } finally {
      if (!controller.signal.aborted) setLoadingGraphPlaylist(false)
    }
  }

  const handleCloseGraphPlaylistDialog = () => {
    viewRequest.current?.abort()
    setGraphPlaylistDialogOpen(false)
    setViewingGraphPlaylist(null)
    setGraphPlaylistItems([])
  }

  return {
    // Data
    channels,
    graphPlaylists,
    loading,
    loadingGraph,
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
    // Graph playlist dialog state
    graphPlaylistDialogOpen,
    viewingGraphPlaylist,
    graphPlaylistItems,
    loadingGraphPlaylist,
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
    handleViewGraphPlaylist,
    handleCloseGraphPlaylistDialog,
  }
}
