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
  Switch,
  FormControlLabel,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonIcon from '@mui/icons-material/Person'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import SaveIcon from '@mui/icons-material/Save'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PsychologyIcon from '@mui/icons-material/Psychology'
import { useAuth } from '@/hooks/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { TasteProfileSection } from './UserSettings/TasteProfileSection'

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

interface AiExplanationPreference {
  overrideAllowed: boolean
  userPreference: boolean | null
  effectiveValue: boolean
  globalEnabled: boolean
  canOverride: boolean
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
  const [moviesLibraryName, setMoviesLibraryName] = useState<string>('')
  const [seriesLibraryName, setSeriesLibraryName] = useState<string>('')

  // AI explanation preference state
  const [aiExplanationPref, setAiExplanationPref] = useState<AiExplanationPreference | null>(null)
  const [loadingAiPref, setLoadingAiPref] = useState(false)
  const [savingAiPref, setSavingAiPref] = useState(false)
  const [aiPrefError, setAiPrefError] = useState<string | null>(null)
  const [aiPrefSuccess, setAiPrefSuccess] = useState<string | null>(null)

  // Dislike behavior preference state
  const [dislikeBehavior, setDislikeBehavior] = useState<'exclude' | 'penalize'>('exclude')
  const [loadingDislikePref, setLoadingDislikePref] = useState(false)
  const [savingDislikePref, setSavingDislikePref] = useState(false)
  const [dislikePrefSuccess, setDislikePrefSuccess] = useState<string | null>(null)

  // Include watched preference state
  const [includeWatched, setIncludeWatched] = useState(false)
  const [loadingIncludeWatched, setLoadingIncludeWatched] = useState(false)
  const [savingIncludeWatched, setSavingIncludeWatched] = useState(false)
  const [includeWatchedSuccess, setIncludeWatchedSuccess] = useState<string | null>(null)

  // Trakt integration state
  const [traktStatus, setTraktStatus] = useState<{
    traktConfigured: boolean
    connected: boolean
    username: string | null
    syncedAt: string | null
  } | null>(null)
  const [loadingTrakt, setLoadingTrakt] = useState(false)
  const [syncingTrakt, setSyncingTrakt] = useState(false)
  const [traktMessage, setTraktMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchUserSettings()
    fetchAiExplanationPref()
    fetchDislikeBehavior()
    fetchIncludeWatched()
    fetchTraktStatus()
    
    // Check for Trakt callback params
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (params.get('trakt') === 'success') {
      const username = params.get('username')
      setTraktMessage({ type: 'success', text: `Successfully connected to Trakt as ${username}!` })
      fetchTraktStatus()
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    } else if (params.get('trakt') === 'error') {
      const message = params.get('message') || 'Unknown error'
      setTraktMessage({ type: 'error', text: `Failed to connect: ${message}` })
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
  }, [])

  const fetchUserSettings = async () => {
    setLoadingUserSettings(true)
    setUserSettingsError(null)
    try {
      const response = await fetch('/api/settings/user', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDefaultLibraryPrefix(data.defaults?.libraryNamePrefix || 'AI Picks - ')
        setMoviesLibraryName(data.settings?.libraryName || '')
        setSeriesLibraryName(data.settings?.seriesLibraryName || '')
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
          libraryName: moviesLibraryName.trim() || null,
          seriesLibraryName: seriesLibraryName.trim() || null,
        }),
      })
      if (response.ok) {
        setUserSettingsSuccess('Library names saved! They will be used for future library updates.')
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

  const fetchAiExplanationPref = async () => {
    setLoadingAiPref(true)
    try {
      const response = await fetch('/api/settings/user/ai-explanation', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAiExplanationPref(data)
      }
    } catch {
      // Silently fail - this is optional functionality
    } finally {
      setLoadingAiPref(false)
    }
  }

  const saveAiExplanationPref = async (enabled: boolean | null) => {
    if (!aiExplanationPref) return
    setSavingAiPref(true)
    setAiPrefError(null)
    setAiPrefSuccess(null)
    try {
      const response = await fetch('/api/settings/user/ai-explanation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })
      if (response.ok) {
        const data = await response.json()
        setAiExplanationPref({
          ...aiExplanationPref,
          userPreference: data.userPreference,
          effectiveValue: data.effectiveValue,
        })
        setAiPrefSuccess(data.message)
        setTimeout(() => setAiPrefSuccess(null), 5000)
      } else {
        const err = await response.json()
        setAiPrefError(err.error || 'Failed to save preference')
      }
    } catch {
      setAiPrefError('Could not connect to server')
    } finally {
      setSavingAiPref(false)
    }
  }

  const fetchDislikeBehavior = async () => {
    setLoadingDislikePref(true)
    try {
      const response = await fetch('/api/settings/user/dislike-behavior', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDislikeBehavior(data.dislikeBehavior || 'exclude')
      }
    } catch {
      // Silently fail - use default
    } finally {
      setLoadingDislikePref(false)
    }
  }

  const saveDislikeBehavior = async (behavior: 'exclude' | 'penalize') => {
    setSavingDislikePref(true)
    setDislikePrefSuccess(null)
    try {
      const response = await fetch('/api/settings/user/dislike-behavior', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dislikeBehavior: behavior }),
      })
      if (response.ok) {
        setDislikeBehavior(behavior)
        setDislikePrefSuccess('Preference saved!')
        setTimeout(() => setDislikePrefSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingDislikePref(false)
    }
  }

  const fetchIncludeWatched = async () => {
    if (!user?.id) return
    setLoadingIncludeWatched(true)
    try {
      const response = await fetch(`/api/recommendations/${user.id}/preferences`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setIncludeWatched(data.includeWatched ?? false)
      }
    } catch {
      // Silently fail - use default
    } finally {
      setLoadingIncludeWatched(false)
    }
  }

  const saveIncludeWatched = async (value: boolean) => {
    if (!user?.id) return
    setSavingIncludeWatched(true)
    setIncludeWatchedSuccess(null)
    try {
      const response = await fetch(`/api/recommendations/${user.id}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeWatched: value }),
      })
      if (response.ok) {
        setIncludeWatched(value)
        setIncludeWatchedSuccess('Preference saved!')
        setTimeout(() => setIncludeWatchedSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingIncludeWatched(false)
    }
  }

  const fetchTraktStatus = async () => {
    setLoadingTrakt(true)
    try {
      const response = await fetch('/api/trakt/status', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setTraktStatus(data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingTrakt(false)
    }
  }

  const connectTrakt = async () => {
    try {
      const response = await fetch('/api/trakt/auth-url', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authUrl
      } else {
        const err = await response.json()
        setTraktMessage({ type: 'error', text: err.error || 'Failed to start Trakt connection' })
      }
    } catch {
      setTraktMessage({ type: 'error', text: 'Could not connect to server' })
    }
  }

  const disconnectTrakt = async () => {
    try {
      const response = await fetch('/api/trakt/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        setTraktStatus(prev => prev ? { ...prev, connected: false, username: null, syncedAt: null } : null)
        setTraktMessage({ type: 'success', text: 'Trakt disconnected successfully' })
        setTimeout(() => setTraktMessage(null), 3000)
      }
    } catch {
      setTraktMessage({ type: 'error', text: 'Failed to disconnect Trakt' })
    }
  }

  const syncTraktRatings = async () => {
    setSyncingTrakt(true)
    setTraktMessage(null)
    try {
      const response = await fetch('/api/trakt/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setTraktMessage({ type: 'success', text: data.message })
        fetchTraktStatus()
      } else {
        const err = await response.json()
        setTraktMessage({ type: 'error', text: err.error || 'Failed to sync ratings' })
      }
    } catch {
      setTraktMessage({ type: 'error', text: 'Could not connect to server' })
    } finally {
      setSyncingTrakt(false)
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
          <Tab icon={<PsychologyIcon />} iconPosition="start" label="Taste Profile" />
          <Tab icon={<VideoLibraryIcon />} iconPosition="start" label="Preferences" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Profile Tab */}
          <TabPanel value={tabValue} index={0}>
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
                      {user?.isAdmin ? 'Administrator' : 'User'} • {user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : ''}
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

          {/* Taste Profile Tab */}
          <TabPanel value={tabValue} index={1}>
            <TasteProfileSection />
          </TabPanel>

          {/* Preferences Tab */}
          <TabPanel value={tabValue} index={2}>
            <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Library Names
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Customize how your AI recommendations libraries appear in your media server.
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
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        Movies Library Name
                      </Typography>
                      <TextField
                        placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'} - Movies`}
                        value={moviesLibraryName}
                        onChange={(e) => setMoviesLibraryName(e.target.value)}
                        size="small"
                        fullWidth
                        inputProps={{ maxLength: 100 }}
                        helperText={
                          moviesLibraryName
                            ? `Your movies library will be named: "${moviesLibraryName}"`
                            : 'Leave empty to use the global default template'
                        }
                      />
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        TV Series Library Name
                      </Typography>
                      <TextField
                        placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'} - TV Series`}
                        value={seriesLibraryName}
                        onChange={(e) => setSeriesLibraryName(e.target.value)}
                        size="small"
                        fullWidth
                        inputProps={{ maxLength: 100 }}
                        helperText={
                          seriesLibraryName
                            ? `Your series library will be named: "${seriesLibraryName}"`
                            : 'Leave empty to use the global default template'
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
                      {(moviesLibraryName || seriesLibraryName) && (
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setMoviesLibraryName('')
                            setSeriesLibraryName('')
                          }}
                          disabled={savingUserSettings}
                          size="small"
                        >
                          Reset to Defaults
                        </Button>
                      )}
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="caption" color="text.secondary">
                      Changes will apply the next time the library sync jobs run or when recommendations are regenerated.
                      If you already have libraries with old names, you may need to manually delete them from your media server.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>

            {/* AI Explanation Preference - only show if user can override */}
            {aiExplanationPref?.canOverride && (
              <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600, mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon color="primary" />
                    AI Explanation Preference
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Choose whether to include AI-generated explanations in your recommendation descriptions.
                  </Typography>

                  {aiPrefError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAiPrefError(null)}>
                      {aiPrefError}
                    </Alert>
                  )}

                  {aiPrefSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAiPrefSuccess(null)}>
                      {aiPrefSuccess}
                    </Alert>
                  )}

                  {loadingAiPref ? (
                    <Box display="flex" justifyContent="center" py={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={aiExplanationPref.userPreference ?? aiExplanationPref.globalEnabled}
                            onChange={(e) => saveAiExplanationPref(e.target.checked)}
                            disabled={savingAiPref}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              Include AI Explanations
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              When enabled, each recommendation includes "Why Aperture picked this for you"
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', ml: 0, mb: 2 }}
                      />

                      {aiExplanationPref.userPreference !== null && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => saveAiExplanationPref(null)}
                          disabled={savingAiPref}
                        >
                          Reset to Default ({aiExplanationPref.globalEnabled ? 'Enabled' : 'Disabled'})
                        </Button>
                      )}

                      <Divider sx={{ my: 3 }} />

                      <Typography variant="caption" color="text.secondary">
                        Changes will apply when your recommendations are next regenerated.
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Include Watched Content */}
            <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600, mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Watched Content in Recommendations
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Choose whether to include content you've already watched in your AI recommendations.
                </Typography>

                {includeWatchedSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setIncludeWatchedSuccess(null)}>
                    {includeWatchedSuccess}
                  </Alert>
                )}

                {loadingIncludeWatched ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={includeWatched}
                          onChange={(e) => saveIncludeWatched(e.target.checked)}
                          disabled={savingIncludeWatched}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {includeWatched ? 'Include Watched Content' : 'New Content Only'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {includeWatched 
                              ? 'Recommendations may include movies and series you\'ve already watched'
                              : 'Recommendations will only show content you haven\'t watched yet'}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', ml: 0 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="caption" color="text.secondary">
                      By default, recommendations only include new content. Enable this if you want rewatching suggestions.
                      Changes will apply when your recommendations are next regenerated.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Disliked Content Behavior */}
            <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600, mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Disliked Content Behavior
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Choose how content you've rated 1-3 hearts should be handled in recommendations.
                </Typography>

                {dislikePrefSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDislikePrefSuccess(null)}>
                    {dislikePrefSuccess}
                  </Alert>
                )}

                {loadingDislikePref ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={dislikeBehavior === 'exclude'}
                          onChange={(e) => saveDislikeBehavior(e.target.checked ? 'exclude' : 'penalize')}
                          disabled={savingDislikePref}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {dislikeBehavior === 'exclude' ? 'Exclude Disliked Content' : 'Penalize Disliked Content'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dislikeBehavior === 'exclude' 
                              ? 'Content you dislike will never appear in recommendations'
                              : 'Content you dislike will appear less often but may still show up occasionally'}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', ml: 0 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="caption" color="text.secondary">
                      Rate content with 1-3 hearts to mark it as disliked. Changes will apply when your recommendations are next regenerated.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Trakt Integration */}
            {traktStatus?.traktConfigured && (
              <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, maxWidth: 600, mt: 3 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Box
                      component="img"
                      src="/trakt.svg"
                      alt="Trakt"
                      sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
                    />
                    <Typography variant="h6">
                      Trakt Integration
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Connect your Trakt account to sync your movie and TV show ratings.
                  </Typography>

                  {traktMessage && (
                    <Alert severity={traktMessage.type} sx={{ mb: 2 }} onClose={() => setTraktMessage(null)}>
                      {traktMessage.text}
                    </Alert>
                  )}

                  {loadingTrakt ? (
                    <Box display="flex" justifyContent="center" py={4}>
                      <CircularProgress />
                    </Box>
                  ) : traktStatus.connected ? (
                    <>
                      <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                        <Typography variant="body2" fontWeight={500}>
                          Connected as: {traktStatus.username}
                        </Typography>
                        {traktStatus.syncedAt && (
                          <Typography variant="caption" color="text.secondary">
                            Last synced: {new Date(traktStatus.syncedAt).toLocaleString()}
                          </Typography>
                        )}
                      </Box>

                      <Box display="flex" gap={1}>
                        <Button
                          variant="contained"
                          onClick={syncTraktRatings}
                          disabled={syncingTrakt}
                          size="small"
                        >
                          {syncingTrakt ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                          {syncingTrakt ? 'Syncing...' : 'Sync Ratings'}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={disconnectTrakt}
                          size="small"
                        >
                          Disconnect
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={connectTrakt}
                      sx={{
                        bgcolor: '#ed1c24',
                        '&:hover': { bgcolor: '#c9171d' },
                      }}
                    >
                      Connect to Trakt
                    </Button>
                  )}

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="caption" color="text.secondary">
                    Syncing imports your Trakt ratings (1-10) as heart ratings in Aperture. Higher-rated content will have more influence on your recommendations.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}

