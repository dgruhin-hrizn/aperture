import React, { useEffect, useState } from 'react'
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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'

interface Channel {
  id: string
  name: string
  description: string | null
  genre_filters: string[]
  is_pinned_row: boolean
  is_active: boolean
  last_generated_at: string | null
}

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', genreFilters: '' })

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

  useEffect(() => {
    fetchChannels()
  }, [])

  const handleOpenDialog = (channel?: Channel) => {
    if (channel) {
      setEditingChannel(channel)
      setFormData({
        name: channel.name,
        description: channel.description || '',
        genreFilters: channel.genre_filters.join(', '),
      })
    } else {
      setEditingChannel(null)
      setFormData({ name: '', description: '', genreFilters: '' })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingChannel(null)
    setFormData({ name: '', description: '', genreFilters: '' })
  }

  const handleSubmit = async () => {
    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      genreFilters: formData.genreFilters
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
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
      }
    } catch {
      // Handle error
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
      }
    } catch {
      // Handle error
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
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
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
            Create custom recommendation channels with genre filters
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
            Create your first channel to get genre-specific recommendations
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
                    <Typography variant="h6">{channel.name}</Typography>
                    {channel.is_pinned_row && (
                      <Chip label="Pinned" size="small" color="primary" />
                    )}
                  </Box>

                  {channel.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {channel.description}
                    </Typography>
                  )}

                  {channel.genre_filters.length > 0 && (
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {channel.genre_filters.map((genre) => (
                        <Chip key={genre} label={genre} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}

                  {channel.last_generated_at && (
                    <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                      Last updated: {new Date(channel.last_generated_at).toLocaleDateString()}
                    </Typography>
                  )}
                </CardContent>

                <CardActions>
                  <IconButton size="small" onClick={() => handleOpenDialog(channel)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(channel.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChannel ? 'Edit Channel' : 'New Channel'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Genre Filters"
            fullWidth
            margin="normal"
            placeholder="Action, Sci-Fi, Thriller"
            helperText="Comma-separated list of genres"
            value={formData.genreFilters}
            onChange={(e) => setFormData({ ...formData, genreFilters: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!formData.name}>
            {editingChannel ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

