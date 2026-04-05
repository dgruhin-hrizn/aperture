import { Card, Typography, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import AddIcon from '@mui/icons-material/Add'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'

interface EmptyStateProps {
  onCreateClick: () => void
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  const { t } = useTranslation()
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
        {t('playlists.emptyTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t('playlists.emptyBody')}
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateClick}>
        {t('playlists.createPlaylist')}
      </Button>
    </Card>
  )
}



