import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { TraktMessage, TraktStatus } from './hooks/useTraktIntegration'

interface TraktIntegrationCardProps {
  status: TraktStatus | null
  loading: boolean
  syncing: boolean
  message: TraktMessage | null
  onDismissMessage: () => void
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
}

export function TraktIntegrationCard({
  status,
  loading,
  syncing,
  message,
  onDismissMessage,
  onConnect,
  onDisconnect,
  onSync,
}: TraktIntegrationCardProps) {
  const { t } = useTranslation()

  if (!status?.traktConfigured) {
    return null
  }

  return (
    <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Box
            component="img"
            src="/trakt.svg"
            alt={t('userSettings.traktAlt')}
            sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
          />
          <Typography variant="h6">{t('userSettings.traktTitle')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('userSettings.traktSubtitle')}
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={onDismissMessage}>
            {message.text}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : status.connected ? (
          <>
            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="body2" fontWeight={500}>
                {t('userSettings.traktConnectedAs', { username: status.username ?? '' })}
              </Typography>
              {status.syncedAt && (
                <Typography variant="caption" color="text.secondary">
                  {t('userSettings.traktLastSynced', {
                    when: new Date(status.syncedAt).toLocaleString(),
                  })}
                </Typography>
              )}
            </Box>

            <Box display="flex" gap={1}>
              <Button variant="contained" onClick={onSync} disabled={syncing} size="small">
                {syncing ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {syncing ? t('userSettings.traktSyncing') : t('userSettings.traktSyncRatings')}
              </Button>
              <Button variant="outlined" color="error" onClick={onDisconnect} size="small">
                {t('userSettings.traktDisconnect')}
              </Button>
            </Box>
          </>
        ) : (
          <Button
            variant="contained"
            onClick={onConnect}
            sx={{
              bgcolor: '#ed1c24',
              '&:hover': { bgcolor: '#c9171d' },
            }}
          >
            {t('userSettings.traktConnect')}
          </Button>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="caption" color="text.secondary">
          {t('userSettings.traktFooter')}
        </Typography>
      </CardContent>
    </Card>
  )
}
