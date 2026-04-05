import { Typography, Card, CardContent, TextField, Box, Avatar } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface ProfileSectionProps {
  user: {
    username?: string
    displayName?: string | null
    provider?: string
    isAdmin?: boolean
    avatarUrl?: string | null
  } | null
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const { t } = useTranslation()
  const displayName = user?.displayName || user?.username || t('settingsPage.profileFallbackName')
  const roleLabel = user?.isAdmin ? t('nav.roleLabelAdmin') : t('nav.roleLabelUser')
  const providerLabel = user?.provider
    ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1)
    : ''

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={3}>
          {t('settingsPage.profileTitle')}
        </Typography>

        <Box display="flex" alignItems="center" gap={3} mb={4}>
          <Avatar
            src={user?.avatarUrl || undefined}
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.main',
              fontSize: '2rem',
            }}
          >
            {user?.username?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settingsPage.profileSubtitle', { role: roleLabel, provider: providerLabel })}
            </Typography>
          </Box>
        </Box>

        <TextField
          label={t('settingsPage.profileUsernameLabel')}
          value={user?.username || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label={t('settingsPage.profileDisplayNameLabel')}
          value={user?.displayName || user?.username || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label={t('settingsPage.profileProviderLabel')}
          value={user?.provider || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label={t('settingsPage.profileRoleLabel')}
          value={roleLabel}
          fullWidth
          margin="normal"
          disabled
        />
      </CardContent>
    </Card>
  )
}
