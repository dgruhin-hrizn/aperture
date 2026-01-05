import { useState } from 'react'
import { 
  Box, Typography, Button, Chip, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Tooltip, Snackbar
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { Movie, MediaServerInfo, WatchStatus } from '../types'
import { formatRuntime } from '../hooks'

interface MovieHeroProps {
  movie: Movie
  mediaServer: MediaServerInfo | null
  watchStatus: WatchStatus | null
  canManageWatchHistory: boolean
  userId?: string
  onMarkedUnwatched?: () => void
}

export function MovieHero({ movie, mediaServer, watchStatus, canManageWatchHistory, userId, onMarkedUnwatched }: MovieHeroProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const handlePlayOnEmby = () => {
    if (!mediaServer?.baseUrl || !movie?.provider_item_id) {
      return
    }

    // Open the item in the media server's web client
    // For Emby: /web/index.html#!/item?id=ITEM_ID&serverId=SERVER_ID
    // For Jellyfin: /web/index.html#!/details?id=ITEM_ID&serverId=SERVER_ID
    const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
    const itemPath = mediaServer.type === 'jellyfin'
      ? `#!/details?id=${movie.provider_item_id}${serverIdParam}`
      : `#!/item?id=${movie.provider_item_id}${serverIdParam}`

    window.open(`${mediaServer.baseUrl}/web/index.html${itemPath}`, '_blank')
  }

  const handleMarkUnwatched = async () => {
    if (!userId) return

    setMarking(true)
    try {
      const response = await fetch(`/api/users/${userId}/watch-history/movies/${movie.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        setSnackbar({ open: true, message: 'Movie marked as unwatched', severity: 'success' })
        onMarkedUnwatched?.()
      } else {
        const error = await response.json()
        setSnackbar({ open: true, message: error.error || 'Failed to mark as unwatched', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to mark as unwatched', severity: 'error' })
    } finally {
      setMarking(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
    
    <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' }, mt: -20, position: 'relative', zIndex: 1, px: 3 }}>
      {/* Poster */}
      <Box sx={{ flexShrink: 0 }}>
        <Paper
          elevation={8}
          sx={{
            width: { xs: 150, md: 220 },
            height: { xs: 225, md: 330 },
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'grey.900',
          }}
        >
          {movie.poster_url ? (
            <Box
              component="img"
              src={movie.poster_url}
              alt={movie.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.800',
              }}
            >
              <Typography variant="body2" color="text.secondary" textAlign="center" p={2}>
                {movie.title}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1 }}>
        {/* Status badges */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Chip
            label="Available"
            size="small"
            sx={{
              bgcolor: 'success.main',
              color: 'white',
              fontWeight: 600,
            }}
          />
          {watchStatus?.isWatched && (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              label={watchStatus.playCount > 1 ? `Watched ${watchStatus.playCount}x` : 'Watched'}
              size="small"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
              }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
          {movie.title}
          {movie.year && (
            <Typography component="span" variant="h4" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
              ({movie.year})
            </Typography>
          )}
        </Typography>

        {/* Meta row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {movie.genres && movie.genres.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {movie.genres.join(' • ')}
            </Typography>
          )}
          {movie.runtime_minutes && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatRuntime(movie.runtime_minutes)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <IconButton
            sx={{
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <StarBorderIcon />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={handlePlayOnEmby}
            disabled={!mediaServer?.baseUrl}
            sx={{ borderRadius: 2 }}
          >
            {mediaServer?.type === 'jellyfin' ? 'Play on Jellyfin' : 'Play on Emby'}
          </Button>
          {watchStatus?.isWatched && canManageWatchHistory && (
            <Tooltip title="Mark as unwatched - removes from watch history in both media server and Aperture">
              <Button
                variant="outlined"
                color="warning"
                startIcon={<VisibilityOffIcon />}
                onClick={() => setConfirmOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Mark Unwatched
              </Button>
            </Tooltip>
          )}
        </Box>

        {/* Rating */}
        {movie.community_rating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight={600}>
                {Number(movie.community_rating).toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / 10
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>

    {/* Confirmation Dialog */}
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as Unwatched?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will mark "{movie.title}" as unwatched in your media server and remove it from your Aperture watch history.
        </DialogContentText>
        <DialogContentText sx={{ mt: 1, fontWeight: 500, color: 'warning.main' }}>
          This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmOpen(false)} disabled={marking}>Cancel</Button>
        <Button onClick={handleMarkUnwatched} color="error" variant="contained" disabled={marking}>
          {marking ? 'Marking...' : 'Mark Unwatched'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar */}
    <Snackbar
      open={snackbar.open}
      autoHideDuration={4000}
      onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      message={snackbar.message}
    />
    </>
  )
}

