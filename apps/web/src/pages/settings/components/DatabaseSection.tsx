import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningIcon from '@mui/icons-material/Warning'
import type { PurgeStats } from '../types'

interface DatabaseSectionProps {
  purgeStats: PurgeStats | null
  loadingPurgeStats: boolean
  purging: boolean
  purgeError: string | null
  setPurgeError: (error: string | null) => void
  purgeSuccess: string | null
  setPurgeSuccess: (success: string | null) => void
  showPurgeConfirm: boolean
  setShowPurgeConfirm: (show: boolean) => void
  onPurge: () => void
}

export function DatabaseSection({
  purgeStats,
  loadingPurgeStats,
  purging,
  purgeError,
  setPurgeError,
  purgeSuccess,
  setPurgeSuccess,
  showPurgeConfirm,
  setShowPurgeConfirm,
  onPurge,
}: DatabaseSectionProps) {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'error.dark' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <DeleteForeverIcon color="error" />
          <Typography variant="h6" color="error.main">
            Database Management
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Danger Zone!</strong> These actions are irreversible and will delete data.
        </Alert>

        {purgeError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPurgeError(null)}>
            {purgeError}
          </Alert>
        )}

        {purgeSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPurgeSuccess(null)}>
            {purgeSuccess}
          </Alert>
        )}

        {/* Current Stats */}
        {loadingPurgeStats ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : purgeStats && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Current Database Contents:</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Movies: <strong>{purgeStats.movies.toLocaleString()}</strong>
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Embeddings: <strong>{purgeStats.embeddings.toLocaleString()}</strong>
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Watch History: <strong>{purgeStats.watchHistory.toLocaleString()}</strong>
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Recommendations: <strong>{purgeStats.recommendations.toLocaleString()}</strong>
                </Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {!showPurgeConfirm ? (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Purge all movie data to start fresh. This will delete all movies, embeddings, 
              watch history, recommendations, and taste profiles. Library configuration and 
              users are preserved.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setShowPurgeConfirm(true)}
              disabled={purging}
            >
              Purge Movie Database
            </Button>
          </Box>
        ) : (
          <Box sx={{ p: 2, bgcolor: 'error.dark', borderRadius: 1, color: 'error.contrastText' }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <WarningIcon />
              <Typography variant="subtitle1" fontWeight={600}>
                Confirm Purge
              </Typography>
            </Box>
            <Typography variant="body2" mb={2}>
              This will permanently delete:
            </Typography>
            <Box component="ul" sx={{ m: 0, mb: 2, pl: 2 }}>
              <li>All {purgeStats?.movies.toLocaleString() || 0} movies</li>
              <li>All {purgeStats?.embeddings.toLocaleString() || 0} AI embeddings</li>
              <li>All {purgeStats?.watchHistory.toLocaleString() || 0} watch history entries</li>
              <li>All recommendations and taste profiles</li>
            </Box>
            <Typography variant="body2" mb={2}>
              After purging, you'll need to re-run: Sync Movies → Generate Embeddings → Sync Watch History → Generate Recommendations
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                color="error"
                startIcon={purging ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                onClick={onPurge}
                disabled={purging}
              >
                {purging ? 'Purging...' : 'Yes, Purge Everything'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowPurgeConfirm(false)}
                disabled={purging}
                sx={{ color: 'error.contrastText', borderColor: 'error.contrastText' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

