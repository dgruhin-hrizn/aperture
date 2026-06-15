import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { User } from '@/hooks/auth-context'

interface UserProfileTabProps {
  user: User | null
  email: string
  originalEmail: string
  emailLocked: boolean
  emailNotificationsEnabled: boolean
  loadingEmail: boolean
  savingEmail: boolean
  emailSuccess: string | null
  onEmailChange: (value: string) => void
  onEmailBlur: () => void
  onNotificationsChange: (enabled: boolean) => void
  onDismissSuccess: () => void
  emailError?: string | null
  onDismissEmailError?: () => void
}

export function UserProfileTab({
  user,
  email,
  emailLocked,
  emailNotificationsEnabled,
  loadingEmail,
  savingEmail,
  emailSuccess,
  onEmailChange,
  onEmailBlur,
  onNotificationsChange,
  onDismissSuccess,
  emailError,
  onDismissEmailError,
}: UserProfileTabProps) {
  const { t } = useTranslation()

  return (
    <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={3} mb={4}>
          <Avatar
            src={user?.avatarUrl || undefined}
            sx={{
              width: 72,
              height: 72,
              bgcolor: 'primary.main',
              fontSize: '1.75rem',
            }}
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {user?.displayName || user?.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.isAdmin ? t('userSettings.roleAdmin') : t('userSettings.roleUser')} •{' '}
              {user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : ''}
            </Typography>
          </Box>
        </Box>

        <TextField
          label={t('login.username')}
          value={user?.username || ''}
          fullWidth
          margin="normal"
          disabled
          size="small"
        />

        <TextField
          label={t('userSettings.displayName')}
          value={user?.displayName || user?.username || ''}
          fullWidth
          margin="normal"
          disabled
          size="small"
        />

        <TextField
          label={t('userSettings.mediaServer')}
          value={user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : ''}
          fullWidth
          margin="normal"
          disabled
          size="small"
        />

        <TextField
          label={t('userSettings.roleField')}
          value={user?.isAdmin ? t('userSettings.roleAdmin') : t('userSettings.roleUser')}
          fullWidth
          margin="normal"
          disabled
          size="small"
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          {t('userSettings.profileSyncedCaption')}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('userSettings.emailSectionTitle')}
        </Typography>

        {emailError && onDismissEmailError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissEmailError}>
            {emailError}
          </Alert>
        )}

        {emailSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={onDismissSuccess}>
            {emailSuccess}
          </Alert>
        )}

        {loadingEmail ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <TextField
              label={t('userSettings.emailAddress')}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              fullWidth
              margin="normal"
              size="small"
              placeholder={t('userSettings.emailPlaceholder')}
              helperText={
                emailLocked ? t('userSettings.emailHelperCustom') : t('userSettings.emailHelperSynced')
              }
              InputProps={{
                endAdornment: savingEmail ? <CircularProgress size={16} /> : null,
              }}
              onBlur={onEmailBlur}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={emailNotificationsEnabled}
                  onChange={(e) => onNotificationsChange(e.target.checked)}
                  disabled={savingEmail}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">{t('userSettings.emailNotificationsTitle')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('userSettings.emailNotificationsSubtitle')}
                  </Typography>
                </Box>
              }
              sx={{ mt: 1, alignItems: 'flex-start' }}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
