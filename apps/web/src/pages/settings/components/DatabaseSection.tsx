import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [confirmationText, setConfirmationText] = useState('')

  const confirmPhrase = t('settingsDatabase.confirmPhrase')
  const isConfirmationValid = confirmationText.toLowerCase() === confirmPhrase.toLowerCase()

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
            {t('settingsDatabase.title')}
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>{t('settingsDatabase.dangerTitle')}</strong> {t('settingsDatabase.dangerBody')}
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

        {loadingPurgeStats ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          purgeStats && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {t('settingsDatabase.currentContents')}
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
                  gap: 3,
                  mt: 2,
                }}
              >
                <StatGroup title={t('settingsDatabase.groupContentLibrary')} icon={<MovieIcon sx={{ fontSize: 18, color: 'primary.main' }} />}>
                  <StatRow label={t('settingsDatabase.statMovies')} value={purgeStats.movies} />
                  <StatRow label={t('settingsDatabase.statSeries')} value={purgeStats.series} />
                  <StatRow label={t('settingsDatabase.statEpisodes')} value={purgeStats.episodes} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label={t('settingsDatabase.statTotal')} value={totalContent} />
                </StatGroup>

                <StatGroup title={t('settingsDatabase.groupAiEmbeddings')} icon={<PsychologyIcon sx={{ fontSize: 18, color: 'secondary.main' }} />}>
                  <StatRow label={t('settingsDatabase.statMovieEmbeddings')} value={purgeStats.movieEmbeddings} />
                  <StatRow label={t('settingsDatabase.statSeriesEmbeddings')} value={purgeStats.seriesEmbeddings} />
                  <StatRow label={t('settingsDatabase.statEpisodeEmbeddings')} value={purgeStats.episodeEmbeddings} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label={t('settingsDatabase.statTotal')} value={totalEmbeddings} />
                </StatGroup>

                <StatGroup title={t('settingsDatabase.groupUserData')} icon={<PersonIcon sx={{ fontSize: 18, color: 'info.main' }} />}>
                  <StatRow label={t('settingsDatabase.statWatchHistory')} value={purgeStats.watchHistory} />
                  <StatRow label={t('settingsDatabase.statUserRatings')} value={purgeStats.userRatings} />
                  <StatRow label={t('settingsDatabase.statRecommendations')} value={purgeStats.recommendations} />
                  <StatRow label={t('settingsDatabase.statTasteProfiles')} value={purgeStats.userPreferences} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label={t('settingsDatabase.statTotal')} value={totalUserData} />
                </StatGroup>

                <StatGroup title={t('settingsDatabase.groupAiAssistant')} icon={<SmartToyIcon sx={{ fontSize: 18, color: 'success.main' }} />}>
                  <StatRow label={t('settingsDatabase.statConversations')} value={purgeStats.assistantConversations} />
                  <StatRow label={t('settingsDatabase.statMessages')} value={purgeStats.assistantMessages} />
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow label={t('settingsDatabase.statTotal')} value={totalAssistant} />
                </StatGroup>
              </Box>
            </Box>
          )
        )}

        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('settingsDatabase.purgeDescription')}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setShowPurgeConfirm(true)}
            disabled={purging}
          >
            {t('settingsDatabase.purgeButton')}
          </Button>
        </Box>

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
              {t('settingsDatabase.dialogTitle')}
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
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
                controls
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              >
                <source src="/are_you_sure.mp4" type="video/mp4" />
              </video>
            </Box>

            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                {t('settingsDatabase.irreversibleTitle')}
              </Typography>
              <Typography variant="body2">
                {t('settingsDatabase.irreversibleBody')}
              </Typography>
            </Alert>

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
                <li>{t('settingsDatabase.purgeLineMovies', { count: purgeStats?.movies ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineSeries', { count: purgeStats?.series ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineEpisodes', { count: purgeStats?.episodes ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineEmbeddings', { count: totalEmbeddings })}</li>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2, color: 'error.main' }}>
                <li>{t('settingsDatabase.purgeLineWatchHistory', { count: purgeStats?.watchHistory ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineRatings', { count: purgeStats?.userRatings ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineRecs', { count: purgeStats?.recommendations ?? 0 })}</li>
                <li>{t('settingsDatabase.purgeLineChats', { count: purgeStats?.assistantConversations ?? 0 })}</li>
              </Box>
            </Box>

            <Typography variant="body1" fontWeight={600} gutterBottom>
              {t('settingsDatabase.confirmPrompt', { phrase: confirmPhrase })}
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={confirmPhrase}
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={purging}
              error={confirmationText.length > 0 && !isConfirmationValid}
              helperText={
                confirmationText.length > 0 && !isConfirmationValid
                  ? t('settingsDatabase.confirmHelper', { phrase: confirmPhrase })
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
            <Button variant="outlined" onClick={handleCloseConfirm} disabled={purging}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={purging ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
              onClick={handlePurge}
              disabled={!isConfirmationValid || purging}
            >
              {purging ? t('settingsDatabase.purging') : t('settingsDatabase.deleteEverything')}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}
