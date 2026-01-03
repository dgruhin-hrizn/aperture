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
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <VideoLibraryIcon color="primary" />
          <Typography variant="h6">
            Personal Preferences
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Customize your AI recommendations library name as it appears in your media server.
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
                Library Name
              </Typography>
              <TextField
                placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'}`}
                value={libraryNameInput}
                onChange={(e) => setLibraryNameInput(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 100 }}
                helperText={
                  libraryNameInput
                    ? `Your library will be named: "${libraryNameInput}"`
                    : `Leave empty to use default: "${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'}"`
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
                {savingUserSettings ? 'Saving...' : 'Save'}
              </Button>
              {libraryNameInput && (
                <Button
                  variant="outlined"
                  onClick={() => setLibraryNameInput('')}
                  disabled={savingUserSettings}
                  size="small"
                >
                  Reset to Default
                </Button>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              💡 Changes will apply the next time the "Update Permissions" job runs or when recommendations are regenerated.
              If you already have a library with the old name, you may need to manually delete it from your media server.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}

