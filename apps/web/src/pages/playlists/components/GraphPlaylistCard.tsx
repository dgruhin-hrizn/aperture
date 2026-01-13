import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import HubIcon from '@mui/icons-material/Hub'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import type { GraphPlaylist } from '../types'

interface GraphPlaylistCardProps {
  playlist: GraphPlaylist
  onDelete: (playlistId: string) => void
}

export function GraphPlaylistCard({ playlist, onDelete }: GraphPlaylistCardProps) {
  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Graph Badge */}
      <Tooltip title="Created from similarity graph">
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'primary.main',
            borderRadius: 1,
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HubIcon sx={{ fontSize: 16, color: 'white' }} />
        </Box>
      </Tooltip>

      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1} pr={4}>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {playlist.name}
          </Typography>
        </Box>

        {playlist.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            mb={2}
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {playlist.description}
          </Typography>
        )}

        <Box display="flex" gap={1} mb={2}>
          <Chip
            icon={playlist.sourceItemType === 'series' ? <TvIcon /> : <MovieIcon />}
            label={`${playlist.itemCount} items`}
            size="small"
            variant="outlined"
          />
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Created: {new Date(playlist.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <IconButton size="small" onClick={() => onDelete(playlist.id)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  )
}

