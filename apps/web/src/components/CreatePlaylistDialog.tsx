import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
  Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import { getProxiedImageUrl } from '@aperture/ui'

interface GraphNode {
  id: string
  title: string
  year: number | null
  type: 'movie' | 'series'
  poster_url: string | null
}

interface CreatePlaylistDialogProps {
  open: boolean
  onClose: () => void
  nodes: GraphNode[]
  sourceItemId?: string
  sourceItemType?: 'movie' | 'series'
  onSuccess?: () => void
}

export function CreatePlaylistDialog({
  open,
  onClose,
  nodes,
  sourceItemId,
  sourceItemType,
  onSuccess,
}: CreatePlaylistDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [generatingName, setGeneratingName] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Separate nodes by type
  const movieIds = nodes.filter((n) => n.type === 'movie').map((n) => n.id)
  const seriesIds = nodes.filter((n) => n.type === 'series').map((n) => n.id)

  const handleGenerateName = useCallback(async () => {
    setGeneratingName(true)
    setError(null)

    try {
      const response = await fetch('/api/graph-playlists/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ movieIds, seriesIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate name')
      }

      const data = await response.json()
      setName(data.name)
    } catch (err) {
      setError('Failed to generate name. Please try again.')
    } finally {
      setGeneratingName(false)
    }
  }, [movieIds, seriesIds])

  const handleGenerateDescription = useCallback(async () => {
    setGeneratingDescription(true)
    setError(null)

    try {
      const response = await fetch('/api/graph-playlists/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ movieIds, seriesIds, name: name || undefined }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate description')
      }

      const data = await response.json()
      setDescription(data.description)
    } catch (err) {
      setError('Failed to generate description. Please try again.')
    } finally {
      setGeneratingDescription(false)
    }
  }, [movieIds, seriesIds, name])

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Please enter a playlist name')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/graph-playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          movieIds,
          seriesIds,
          sourceItemId,
          sourceItemType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create playlist')
      }

      // Success - close dialog and notify parent
      onClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist')
    } finally {
      setCreating(false)
    }
  }, [name, description, movieIds, seriesIds, sourceItemId, sourceItemType, onClose, onSuccess])

  const handleClose = () => {
    if (!creating) {
      setName('')
      setDescription('')
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAddIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Create Playlist from Graph
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={creating} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Name input */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Playlist Name
            </Typography>
            <Tooltip title="Generate a creative name with AI">
              <span>
                <IconButton
                  size="small"
                  onClick={handleGenerateName}
                  disabled={generatingName || nodes.length === 0}
                  color="primary"
                >
                  {generatingName ? (
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Galactic Adventures"
            disabled={creating}
            size="small"
          />
        </Box>

        {/* Description input */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Description (optional)
            </Typography>
            <Tooltip title="Generate a description with AI">
              <span>
                <IconButton
                  size="small"
                  onClick={handleGenerateDescription}
                  disabled={generatingDescription || nodes.length === 0}
                  color="primary"
                >
                  {generatingDescription ? (
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of this playlist..."
            multiline
            rows={2}
            disabled={creating}
            size="small"
          />
        </Box>

        {/* Items preview */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {nodes.length} items will be added:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': {
                height: 6,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 3,
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255,255,255,0.3)',
                borderRadius: 3,
              },
            }}
          >
            {nodes.slice(0, 12).map((node) => (
              <Tooltip key={node.id} title={`${node.title} (${node.year || 'N/A'})`}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 60,
                    height: 90,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'rgba(0,0,0,0.3)',
                  }}
                >
                  {node.poster_url ? (
                    <img
                      src={getProxiedImageUrl(node.poster_url)}
                      alt={node.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        color: 'text.secondary',
                        textAlign: 'center',
                        p: 0.5,
                      }}
                    >
                      {node.title}
                    </Box>
                  )}
                </Box>
              </Tooltip>
            ))}
            {nodes.length > 12 && (
              <Box
                sx={{
                  flexShrink: 0,
                  width: 60,
                  height: 90,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  +{nodes.length - 12}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating || !name.trim() || nodes.length === 0}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <PlaylistAddIcon />}
        >
          {creating ? 'Creating...' : 'Create Playlist'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

