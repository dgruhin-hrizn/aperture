import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { Channel } from '../types'

interface PlaylistCardProps {
  channel: Channel
  generatingChannelId: string | null
  onEdit: (channel: Channel) => void
  onDelete: (channelId: string) => void
  onGenerate: (channelId: string) => void
  onView: (channel: Channel) => void
}

export function PlaylistCard({
  channel,
  generatingChannelId,
  onEdit,
  onDelete,
  onGenerate,
  onView,
}: PlaylistCardProps) {
  return (
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
            onClick={() => onGenerate(channel.id)}
            disabled={generatingChannelId === channel.id}
          >
            {channel.playlist_id ? 'Refresh' : 'Generate'}
          </Button>
          {channel.playlist_id && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => onView(channel)}
            >
              View
            </Button>
          )}
        </Box>
        <Box>
          <IconButton size="small" onClick={() => onEdit(channel)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(channel.id)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </CardActions>
    </Card>
  )
}


