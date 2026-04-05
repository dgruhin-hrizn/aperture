import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
} from '@mui/material'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import SaveIcon from '@mui/icons-material/Save'
import { useTranslation } from 'react-i18next'

interface PersonalPreferencesSectionProps {
  user: { displayName?: string | null; username?: string } | null
  defaultLibraryPrefix: string
  loadingUserSettings: boolean
  savingUserSettings: boolean
  userSettingsError: string | null
  setUserSettingsError: (error: string | null) => void
  userSettingsSuccess: string | null
  setUserSettingsSuccess: (success: string | null) => void
  libraryNameInput: string
  setLibraryNameInput: (value: string) => void
  onSave: () => void
}

export function PersonalPreferencesSection({
  user,
  defaultLibraryPrefix,
  loadingUserSettings,
  savingUserSettings,
  userSettingsError,
  setUserSettingsError,
  userSettingsSuccess,
  setUserSettingsSuccess,
  libraryNameInput,
  setLibraryNameInput,
  onSave,
}: PersonalPreferencesSectionProps) {
  const { t } = useTranslation()
  const fallbackName = user?.displayName || user?.username || t('settingsPage.profileFallbackName')
  const defaultFullName = `${defaultLibraryPrefix}${fallbackName}`

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <VideoLibraryIcon color="primary" />
          <Typography variant="h6">{t('settingsPage.personalPrefsTitle')}</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('settingsPage.personalPrefsSubtitle')}
        </Typography>

        {userSettingsError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUserSettingsError(null)}>
            {userSettingsError}
          </Alert>
        )}

        {userSettingsSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUserSettingsSuccess(null)}>
            {userSettingsSuccess}
          </Alert>
        )}

        {loadingUserSettings ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('settingsPage.personalPrefsLibraryName')}
              </Typography>
              <TextField
                placeholder={defaultFullName}
                value={libraryNameInput}
                onChange={(e) => setLibraryNameInput(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 100 }}
                helperText={
                  libraryNameInput
                    ? t('settingsPage.personalPrefsHelperNamed', { name: libraryNameInput })
                    : t('settingsPage.personalPrefsHelperDefault', { name: defaultFullName })
                }
              />
            </FormControl>

            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={savingUserSettings ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={onSave}
                disabled={savingUserSettings}
                size="small"
              >
                {savingUserSettings ? t('common.saving') : t('common.save')}
              </Button>
              {libraryNameInput && (
                <Button
                  variant="outlined"
                  onClick={() => setLibraryNameInput('')}
                  disabled={savingUserSettings}
                  size="small"
                >
                  {t('settingsPage.personalPrefsReset')}
                </Button>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              {t('settingsPage.personalPrefsFooter')}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
