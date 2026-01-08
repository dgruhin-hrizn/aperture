import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningIcon from '@mui/icons-material/Warning'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import PsychologyIcon from '@mui/icons-material/Psychology'
import PersonIcon from '@mui/icons-material/Person'
import SmartToyIcon from '@mui/icons-material/SmartToy'
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

        {!showPurgeConfirm ? (
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1,
                mb: 2,
              }}
            >
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>{purgeStats?.movies.toLocaleString() || 0} movies</li>
                <li>{purgeStats?.series.toLocaleString() || 0} series</li>
                <li>{purgeStats?.episodes.toLocaleString() || 0} episodes</li>
                <li>{totalEmbeddings.toLocaleString()} AI embeddings</li>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>{purgeStats?.watchHistory.toLocaleString() || 0} watch history entries</li>
                <li>{purgeStats?.userRatings.toLocaleString() || 0} user ratings</li>
                <li>{purgeStats?.recommendations.toLocaleString() || 0} recommendations</li>
                <li>{purgeStats?.assistantConversations.toLocaleString() || 0} assistant chats</li>
              </Box>
            </Box>
            <Typography variant="body2" mb={2}>
              After purging, you'll need to re-run: Sync Movies → Sync Series → Generate Embeddings → Sync Watch
              History → Generate Recommendations
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
