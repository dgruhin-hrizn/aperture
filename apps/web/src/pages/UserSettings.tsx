import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  Divider,
  Avatar,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonIcon from '@mui/icons-material/Person'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import SaveIcon from '@mui/icons-material/Save'
import { useAuth } from '@/hooks/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

interface UserSettingsState {
  libraryName: string | null
}

export function UserSettingsPage() {
  const { user } = useAuth()
  const [tabValue, setTabValue] = useState(0)

  // User settings state
  const [defaultLibraryPrefix, setDefaultLibraryPrefix] = useState<string>('AI Picks - ')
  const [loadingUserSettings, setLoadingUserSettings] = useState(false)
  const [savingUserSettings, setSavingUserSettings] = useState(false)
  const [userSettingsError, setUserSettingsError] = useState<string | null>(null)
  const [userSettingsSuccess, setUserSettingsSuccess] = useState<string | null>(null)
  const [libraryNameInput, setLibraryNameInput] = useState<string>('')

  useEffect(() => {
    fetchUserSettings()
  }, [])

  const fetchUserSettings = async () => {
    setLoadingUserSettings(true)
    setUserSettingsError(null)
    try {
      const response = await fetch('/api/settings/user', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDefaultLibraryPrefix(data.defaults?.libraryNamePrefix || 'AI Picks - ')
        setLibraryNameInput(data.settings?.libraryName || '')
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to load user settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setLoadingUserSettings(false)
    }
  }

  const saveUserSettings = async () => {
    setSavingUserSettings(true)
    setUserSettingsError(null)
    setUserSettingsSuccess(null)
    try {
      const response = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          libraryName: libraryNameInput.trim() || null,
        }),
      })
      if (response.ok) {
        setUserSettingsSuccess('Library name saved! It will be used for future library updates.')
        setTimeout(() => setUserSettingsSuccess(null), 5000)
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to save settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setSavingUserSettings(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs />
        
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <SettingsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Settings
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage your profile and preferences
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 2,
        }}
        elevation={0}
      >
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
            },
          }}
        >
          <Tab icon={<PersonIcon />} iconPosition="start" label="Profile" />
          <Tab icon={<VideoLibraryIcon />} iconPosition="start" label="Preferences" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Profile Tab */}
          <TabPanel value={tabValue} index={0}>
            <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={3} mb={4}>
                  <Avatar
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
                      {user?.isAdmin ? 'Administrator' : 'User'}
                    </Typography>
                  </Box>
                </Box>

                <TextField
                  label="Username"
                  value={user?.username || ''}
                  fullWidth
                  margin="normal"
                  disabled
                  size="small"
                />

                <TextField
                  label="Display Name"
                  value={user?.displayName || user?.username || ''}
                  fullWidth
                  margin="normal"
                  disabled
                  size="small"
                />

                <TextField
                  label="Media Server"
                  value={user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : ''}
                  fullWidth
                  margin="normal"
                  disabled
                  size="small"
                />

                <TextField
                  label="Role"
                  value={user?.isAdmin ? 'Administrator' : 'User'}
                  fullWidth
                  margin="normal"
                  disabled
                  size="small"
                />

                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Profile information is synced from your media server and cannot be edited here.
                </Typography>
              </CardContent>
            </Card>
          </TabPanel>

          {/* Preferences Tab */}
          <TabPanel value={tabValue} index={1}>
            <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Library Name
                </Typography>
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
                        onClick={saveUserSettings}
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
                      Changes will apply the next time the "Update Permissions" job runs or when recommendations are regenerated.
                      If you already have a library with the old name, you may need to manually delete it from your media server.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}

