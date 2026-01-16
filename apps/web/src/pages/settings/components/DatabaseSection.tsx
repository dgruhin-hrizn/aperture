import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  alpha,
} from '@mui/material'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningIcon from '@mui/icons-material/Warning'
import MovieIcon from '@mui/icons-material/Movie'
import PsychologyIcon from '@mui/icons-material/Psychology'
import PersonIcon from '@mui/icons-material/Person'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import type { PurgeStats } from '../types'

const CONFIRMATION_TEXT = 'yes I am sure'

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

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <Box display="flex" justifyContent="space-between" py={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value.toLocaleString()}
      </Typography>
    </Box>
  )
}

function StatGroup({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        {icon}
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ pl: 3.5 }}>{children}</Box>
    </Box>
  )
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
  const [confirmationText, setConfirmationText] = useState('')
  
  const isConfirmationValid = confirmationText.toLowerCase() === CONFIRMATION_TEXT

  // Calculate totals for summary
  const totalContent = purgeStats
    ? purgeStats.movies + purgeStats.series + purgeStats.episodes
    : 0
  const totalEmbeddings = purgeStats
    ? purgeStats.movieEmbeddings + purgeStats.seriesEmbeddings + purgeStats.episodeEmbeddings
    : 0
  const totalUserData = purgeStats
    ? purgeStats.watchHistory + purgeStats.userRatings + purgeStats.recommendations + purgeStats.userPreferences
    : 0
  const totalAssistant = purgeStats
    ? purgeStats.assistantConversations + purgeStats.assistantMessages
    : 0
  
  const handleCloseConfirm = () => {
    setShowPurgeConfirm(false)
    setConfirmationText('')
  }
  
  const handlePurge = () => {
    if (isConfirmationValid) {
      onPurge()
    }
  }

  return (
    <Card
      sx={{ backgroundColor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'error.dark' }}
    >
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
        ) : (
          purgeStats && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Current Database Contents
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
                  gap: 3,
                  mt: 2,
                }}
              >
                {/* Content Library */}
                <StatGroup title="Content Library" icon={<MovieIcon sx={{ fontSize: 18, color: 'primary.main' }} />}>
                  <StatRow label="Movies" value={purgeStats.movies} />
                  <StatRow label="Series" value={purgeStats.series} />
                  <StatRow label="Episodes" value={purgeStats.episodes} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label="Total" value={totalContent} />
                </StatGroup>

                {/* AI Embeddings */}
                <StatGroup title="AI Embeddings" icon={<PsychologyIcon sx={{ fontSize: 18, color: 'secondary.main' }} />}>
                  <StatRow label="Movie" value={purgeStats.movieEmbeddings} />
                  <StatRow label="Series" value={purgeStats.seriesEmbeddings} />
                  <StatRow label="Episode" value={purgeStats.episodeEmbeddings} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label="Total" value={totalEmbeddings} />
                </StatGroup>

                {/* User Data */}
                <StatGroup title="User Data" icon={<PersonIcon sx={{ fontSize: 18, color: 'info.main' }} />}>
                  <StatRow label="Watch History" value={purgeStats.watchHistory} />
                  <StatRow label="User Ratings" value={purgeStats.userRatings} />
                  <StatRow label="Recommendations" value={purgeStats.recommendations} />
                  <StatRow label="Taste Profiles" value={purgeStats.userPreferences} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label="Total" value={totalUserData} />
                </StatGroup>

                {/* Assistant */}
                <StatGroup title="AI Assistant" icon={<SmartToyIcon sx={{ fontSize: 18, color: 'success.main' }} />}>
                  <StatRow label="Conversations" value={purgeStats.assistantConversations} />
                  <StatRow label="Messages" value={purgeStats.assistantMessages} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label="Total" value={totalAssistant} />
                </StatGroup>
              </Box>
            </Box>
          )
        )}

        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Purge all content data to start fresh. This will delete all movies, series, episodes, embeddings, watch
            history, ratings, recommendations, taste profiles, and assistant conversations. Library configuration and
            user accounts are preserved.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setShowPurgeConfirm(true)}
            disabled={purging}
          >
            Purge Content Database
          </Button>
        </Box>

        {/* Purge Confirmation Modal */}
        <Dialog
          open={showPurgeConfirm}
          onClose={handleCloseConfirm}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: 'error.main',
            },
          }}
        >
          <DialogTitle sx={{ bgcolor: alpha('#f44336', 0.1), display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6" color="error.main" fontWeight={700}>
              ⚠️ DANGER: Database Purge
            </Typography>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            {/* Warning Video */}
            <Box
              sx={{
                width: '100%',
                mb: 3,
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'black',
              }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              >
                <source src="/are_you_sure.mp4" type="video/mp4" />
              </video>
            </Box>
            
            {/* Warning Text */}
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                This action is IRREVERSIBLE!
              </Typography>
              <Typography variant="body2">
                You are about to permanently delete ALL content from your database. This includes:
              </Typography>
            </Alert>
            
            {/* What will be deleted */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                mb: 3,
                p: 2,
                bgcolor: alpha('#f44336', 0.05),
                borderRadius: 1,
                border: '1px solid',
                borderColor: alpha('#f44336', 0.2),
              }}
            >
              <Box component="ul" sx={{ m: 0, pl: 2, color: 'error.main' }}>
                <li><strong>{purgeStats?.movies.toLocaleString() || 0}</strong> movies</li>
                <li><strong>{purgeStats?.series.toLocaleString() || 0}</strong> series</li>
                <li><strong>{purgeStats?.episodes.toLocaleString() || 0}</strong> episodes</li>
                <li><strong>{totalEmbeddings.toLocaleString()}</strong> AI embeddings</li>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2, color: 'error.main' }}>
                <li><strong>{purgeStats?.watchHistory.toLocaleString() || 0}</strong> watch history entries</li>
                <li><strong>{purgeStats?.userRatings.toLocaleString() || 0}</strong> user ratings</li>
                <li><strong>{purgeStats?.recommendations.toLocaleString() || 0}</strong> recommendations</li>
                <li><strong>{purgeStats?.assistantConversations.toLocaleString() || 0}</strong> assistant chats</li>
              </Box>
            </Box>
            
            {/* Confirmation Input */}
            <Typography variant="body1" fontWeight={600} gutterBottom>
              To confirm, type "<strong>{CONFIRMATION_TEXT}</strong>" below:
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={CONFIRMATION_TEXT}
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={purging}
              error={confirmationText.length > 0 && !isConfirmationValid}
              helperText={
                confirmationText.length > 0 && !isConfirmationValid
                  ? `Please type exactly: ${CONFIRMATION_TEXT}`
                  : ' '
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: isConfirmationValid ? 'error.main' : undefined,
                  },
                },
              }}
            />
          </DialogContent>
          
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button
              variant="outlined"
              onClick={handleCloseConfirm}
              disabled={purging}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={purging ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
              onClick={handlePurge}
              disabled={!isConfirmationValid || purging}
            >
              {purging ? 'Purging...' : 'Permanently Delete Everything'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}
