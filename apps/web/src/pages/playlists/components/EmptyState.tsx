import { Card, Typography, Button } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'

interface EmptyStateProps {
  onCreateClick: () => void
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
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
        No playlists yet
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Create your first playlist to get custom AI-powered movie recommendations
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateClick}>
        Create Playlist
      </Button>
    </Card>
  )
}



