import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Avatar,
  Button,
  Grid,
  Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import HubIcon from '@mui/icons-material/Hub'
import { getProxiedImageUrl } from '@aperture/ui'
import { useNavigate } from 'react-router-dom'
import type { GraphPlaylist, GraphPlaylistItem } from '../types'

interface GraphPlaylistViewDialogProps {
  open: boolean
  playlist: GraphPlaylist | null
  items: GraphPlaylistItem[]
  loading: boolean
  onClose: () => void
}

export function GraphPlaylistViewDialog({
  open,
  playlist,
  items,
  loading,
  onClose,
}: GraphPlaylistViewDialogProps) {
  const navigate = useNavigate()

  const handleItemClick = (item: GraphPlaylistItem) => {
    onClose()
    if (item.type === 'series') {
      navigate(`/series/${item.id}`)
    } else {
      navigate(`/movies/${item.id}`)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Chip
                icon={<HubIcon />}
                label="Similarity Playlist"
                size="small"
                color="primary"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Box>
            <Typography variant="h6">{playlist?.name}</Typography>
            {playlist?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {playlist.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {items.length} items • Created {playlist && new Date(playlist.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box textAlign="center" py={4}>
            <HubIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No items in playlist
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item.id}>
                <Box
                  onClick={() => handleItemClick(item)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'scale(1.03)',
                      boxShadow: 4,
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      aspectRatio: '2/3',
                      bgcolor: 'action.hover',
                    }}
                  >
                    {item.posterUrl ? (
                      <Avatar
                        src={getProxiedImageUrl(item.posterUrl)}
                        variant="rounded"
                        sx={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 0,
                        }}
                      >
                        {item.type === 'series' ? <TvIcon /> : <MovieIcon />}
                      </Avatar>
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {item.type === 'series' ? (
                          <TvIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        ) : (
                          <MovieIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        )}
                      </Box>
                    )}
                    {/* Type badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        borderRadius: 0.5,
                        px: 0.5,
                        py: 0.25,
                      }}
                    >
                      {item.type === 'series' ? (
                        <TvIcon sx={{ fontSize: 14, color: 'white' }} />
                      ) : (
                        <MovieIcon sx={{ fontSize: 14, color: 'white' }} />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ p: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </Typography>
                    {item.year && (
                      <Typography variant="caption" color="text.secondary">
                        {item.year}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
