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
  Grid,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonIcon from '@mui/icons-material/Person'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import SaveIcon from '@mui/icons-material/Save'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import TuneIcon from '@mui/icons-material/Tune'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { WatcherIdentitySection } from './UserSettings/WatcherIdentitySection'
import { AlgorithmSettingsSection } from './UserSettings/AlgorithmSettingsSection'
import { UserLanguagePreferencesCard } from './UserSettings/UserLanguagePreferencesCard'
import { useTranslation } from 'react-i18next'

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

const USER_SETTINGS_TAB_KEYS = ['profile', 'watcher', 'algorithm', 'preferences'] as const

function userSettingsTabIndexFromParam(tab: string | null): number {
  if (!tab) return 0
  const idx = USER_SETTINGS_TAB_KEYS.indexOf(tab as (typeof USER_SETTINGS_TAB_KEYS)[number])
  return idx >= 0 ? idx : 0
}

function userSettingsTabParamFromIndex(index: number): string {
  return USER_SETTINGS_TAB_KEYS[index] ?? 'profile'
}

interface AiExplanationPreference {
  overrideAllowed: boolean
  userPreference: boolean | null
  effectiveValue: boolean
  globalEnabled: boolean
  canOverride: boolean
}

export function UserSettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tabValue, setTabValue] = useState(() => userSettingsTabIndexFromParam(searchParams.get('tab')))

  useEffect(() => {
    setTabValue(userSettingsTabIndexFromParam(searchParams.get('tab')))
  }, [searchParams])

  const handleMainTabChange = (_: React.SyntheticEvent, v: number) => {
    setTabValue(v)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', userSettingsTabParamFromIndex(v))
        return next
      },
      { replace: true }
    )
  }

  const [identityMediaType, setIdentityMediaType] = useState<'movie' | 'series'>('movie')

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

  // Similarity graph preferences state
  const [similarityFullFranchise, setSimilarityFullFranchise] = useState(false)
  const [similarityHideWatched, setSimilarityHideWatched] = useState(true) // Default ON
  const [loadingSimilarityPrefs, setLoadingSimilarityPrefs] = useState(false)
  const [savingSimilarityPrefs, setSavingSimilarityPrefs] = useState(false)
  const [similarityPrefsSuccess, setSimilarityPrefsSuccess] = useState<string | null>(null)

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

  // Email settings state
  const [email, setEmail] = useState<string>('')
  const [originalEmail, setOriginalEmail] = useState<string>('') // Track original to detect changes
  const [emailLocked, setEmailLocked] = useState(false)
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchUserSettings()
    fetchAiExplanationPref()
    fetchDislikeBehavior()
    fetchIncludeWatched()
    fetchSimilarityPrefs()
    fetchTraktStatus()
    fetchEmailSettings()
    
    // Check for Trakt callback params
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (params.get('trakt') === 'success') {
      const username = params.get('username')
      setTraktMessage({
        type: 'success',
        text: t('userSettings.traktSuccessConnect', { username: username ?? '' }),
      })
      fetchTraktStatus()
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    } else if (params.get('trakt') === 'error') {
      const message = params.get('message') || t('userSettings.traktErrUnknown')
      setTraktMessage({ type: 'error', text: t('userSettings.traktFailConnect', { message }) })
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
  }, [t])

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
        setUserSettingsError(err.error || t('userSettings.errLoadUserSettings'))
      }
    } catch {
      setUserSettingsError(t('userSettings.errConnectServer'))
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
        setUserSettingsSuccess(t('userSettings.libraryNamesSaved'))
        setTimeout(() => setUserSettingsSuccess(null), 5000)
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || t('userSettings.errSaveSettings'))
      }
    } catch {
      setUserSettingsError(t('userSettings.errConnectServer'))
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
        setAiPrefError(err.error || t('userSettings.errSavePreference'))
      }
    } catch {
      setAiPrefError(t('userSettings.errConnectServer'))
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
        setDislikePrefSuccess(t('userSettings.preferenceSaved'))
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
        setIncludeWatchedSuccess(t('userSettings.preferenceSaved'))
        setTimeout(() => setIncludeWatchedSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingIncludeWatched(false)
    }
  }

  const fetchSimilarityPrefs = async () => {
    setLoadingSimilarityPrefs(true)
    try {
      const response = await fetch('/api/settings/user/similarity-prefs', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSimilarityFullFranchise(data.fullFranchiseMode ?? false)
        setSimilarityHideWatched(data.hideWatched ?? true)
      }
    } catch {
      // Silently fail - use defaults
    } finally {
      setLoadingSimilarityPrefs(false)
    }
  }

  const saveSimilarityPref = async (key: 'fullFranchiseMode' | 'hideWatched', value: boolean) => {
    setSavingSimilarityPrefs(true)
    setSimilarityPrefsSuccess(null)
    try {
      const response = await fetch('/api/settings/user/similarity-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      })
      if (response.ok) {
        if (key === 'fullFranchiseMode') {
          setSimilarityFullFranchise(value)
        } else {
          setSimilarityHideWatched(value)
        }
        setSimilarityPrefsSuccess(t('userSettings.preferenceSaved'))
        setTimeout(() => setSimilarityPrefsSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingSimilarityPrefs(false)
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
        setTraktMessage({ type: 'error', text: err.error || t('userSettings.traktErrStart') })
      }
    } catch {
      setTraktMessage({ type: 'error', text: t('userSettings.errConnectServer') })
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
        setTraktMessage({ type: 'success', text: t('userSettings.traktDisconnected') })
        setTimeout(() => setTraktMessage(null), 3000)
      }
    } catch {
      setTraktMessage({ type: 'error', text: t('userSettings.traktErrDisconnect') })
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
        setTraktMessage({ type: 'error', text: err.error || t('userSettings.traktErrSync') })
      }
    } catch {
      setTraktMessage({ type: 'error', text: t('userSettings.errConnectServer') })
    } finally {
      setSyncingTrakt(false)
    }
  }

  const fetchEmailSettings = async () => {
    if (!user?.id) return
    setLoadingEmail(true)
    try {
      const response = await fetch(`/api/users/${user.id}/email-settings`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const emailValue = data.email || ''
        setEmail(emailValue)
        setOriginalEmail(emailValue) // Track original value
        setEmailLocked(data.emailLocked || false)
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingEmail(false)
    }
  }

  const saveEmailSettings = async (newEmail?: string, newNotificationsEnabled?: boolean) => {
    if (!user?.id) return
    
    // Skip save if email hasn't changed
    if (newEmail !== undefined && newEmail.trim() === originalEmail) {
      return
    }
    
    setSavingEmail(true)
    try {
      const body: { email?: string | null; emailNotificationsEnabled?: boolean } = {}
      if (newEmail !== undefined) {
        body.email = newEmail.trim() || null
      }
      if (newNotificationsEnabled !== undefined) {
        body.emailNotificationsEnabled = newNotificationsEnabled
      }

      const response = await fetch(`/api/users/${user.id}/email-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (response.ok) {
        const data = await response.json()
        const emailValue = data.email || ''
        setEmail(emailValue)
        setOriginalEmail(emailValue) // Update original after successful save
        setEmailLocked(data.emailLocked || false)
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
        setEmailSuccess(t('userSettings.emailSettingsSaved'))
        setTimeout(() => setEmailSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingEmail(false)
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
            {t('userSettings.pageTitle')}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('userSettings.pageSubtitle')}
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
          onChange={handleMainTabChange}
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
          <Tab icon={<PersonIcon />} iconPosition="start" label={t('userSettings.tabProfile')} />
          <Tab icon={<FingerprintIcon />} iconPosition="start" label={t('userSettings.tabWatcherIdentity')} />
          <Tab icon={<TuneIcon />} iconPosition="start" label={t('userSettings.tabAlgorithm')} />
          <Tab icon={<VideoLibraryIcon />} iconPosition="start" label={t('userSettings.tabPreferences')} />
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
                      {user?.isAdmin ? t('userSettings.roleAdmin') : t('userSettings.roleUser')} • {user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : ''}
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

                {/* Email Section */}
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {t('userSettings.emailSectionTitle')}
                </Typography>

                {emailSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setEmailSuccess(null)}>
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
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                      margin="normal"
                      size="small"
                      placeholder={t('userSettings.emailPlaceholder')}
                      helperText={
                        emailLocked ? t('userSettings.emailHelperCustom') : t('userSettings.emailHelperSynced')
                      }
                      InputProps={{
                        endAdornment: savingEmail ? (
                          <CircularProgress size={16} />
                        ) : null,
                      }}
                      onBlur={() => saveEmailSettings(email)}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailNotificationsEnabled}
                          onChange={(e) => {
                            setEmailNotificationsEnabled(e.target.checked)
                            saveEmailSettings(undefined, e.target.checked)
                          }}
                          disabled={savingEmail}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t('userSettings.emailNotificationsTitle')}
                          </Typography>
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
          </TabPanel>

          {/* Watcher Identity Tab */}
          <TabPanel value={tabValue} index={1}>
            {/* Sub-tabs for Movies/Series */}
            {(() => {
              const identityAccentColor = identityMediaType === 'movie' ? '#6366f1' : '#ec4899'
              return (
                <Tabs
                  value={identityMediaType}
                  onChange={(_, value) => setIdentityMediaType(value)}
                  sx={{
                    mb: 3,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '& .MuiTab-root': {
                      minHeight: 48,
                      textTransform: 'none',
                    },
                    '& .MuiTabs-indicator': {
                      backgroundColor: identityAccentColor,
                    },
                    '& .Mui-selected': {
                      color: `${identityAccentColor} !important`,
                    },
                  }}
                >
                  <Tab icon={<MovieIcon />} label={t('userSettings.identitySubtabMovies')} value="movie" iconPosition="start" />
                  <Tab icon={<TvIcon />} label={t('userSettings.identitySubtabSeries')} value="series" iconPosition="start" />
                </Tabs>
              )
            })()}

            {/* Unified Watcher Identity Section */}
            <WatcherIdentitySection mediaType={identityMediaType} />
          </TabPanel>

          {/* AI Algorithm Tab */}
          <TabPanel value={tabValue} index={2}>
            {user && <AlgorithmSettingsSection userId={user.id} />}
          </TabPanel>

          {/* Preferences Tab */}
          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <UserLanguagePreferencesCard />
              </Grid>
              {/* AI Library Names */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <TextFieldsIcon color="primary" />
                      <Typography variant="h6">{t('userSettings.aiLibraryNamesTitle')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      {t('userSettings.aiLibraryNamesSubtitle')}
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
                            {t('userSettings.moviesLibraryNameLabel')}
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
                                ? t('userSettings.libraryHelperNamedMovies', { name: moviesLibraryName })
                                : t('userSettings.libraryHelperEmpty')
                            }
                          />
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 3 }}>
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            {t('userSettings.seriesLibraryNameLabel')}
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
                                ? t('userSettings.libraryHelperNamedSeries', { name: seriesLibraryName })
                                : t('userSettings.libraryHelperEmpty')
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
                            {savingUserSettings ? t('userSettings.saving') : t('common.save')}
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
                              {t('userSettings.resetToDefaults')}
                            </Button>
                          )}
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="caption" color="text.secondary">
                          {t('userSettings.aiLibraryFooter')}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* AI Explanation Preference - only show if user can override */}
              {aiExplanationPref?.canOverride && (
                <Grid item xs={12} lg={6}>
                  <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoAwesomeIcon color="primary" />
                        {t('userSettings.aiExplanationTitle')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mb={3}>
                        {t('userSettings.aiExplanationSubtitle')}
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
                                  {t('userSettings.aiExplanationIncludeTitle')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {t('userSettings.aiExplanationIncludeBody')}
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
                              {t('userSettings.aiExplanationReset', {
                                state: aiExplanationPref.globalEnabled
                                  ? t('userSettings.stateEnabled')
                                  : t('userSettings.stateDisabled'),
                              })}
                            </Button>
                          )}

                          <Divider sx={{ my: 3 }} />

                          <Typography variant="caption" color="text.secondary">
                            {t('userSettings.aiExplanationFooter')}
                          </Typography>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Include Watched Content */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <VisibilityIcon color="primary" />
                      <Typography variant="h6">{t('userSettings.watchedRecsTitle')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      {t('userSettings.watchedRecsSubtitle')}
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
                                {includeWatched
                                  ? t('userSettings.includeWatchedTitle')
                                  : t('userSettings.newContentOnlyTitle')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {includeWatched
                                  ? t('userSettings.includeWatchedDesc')
                                  : t('userSettings.newContentOnlyDesc')}
                              </Typography>
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', ml: 0 }}
                        />

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="caption" color="text.secondary">
                          {t('userSettings.watchedRecsFooter')}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Disliked Content Behavior */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ThumbDownIcon color="primary" />
                      <Typography variant="h6">{t('userSettings.dislikedTitle')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      {t('userSettings.dislikedSubtitle')}
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
                                {dislikeBehavior === 'exclude'
                                  ? t('userSettings.excludeDislikedTitle')
                                  : t('userSettings.penalizeDislikedTitle')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {dislikeBehavior === 'exclude'
                                  ? t('userSettings.excludeDislikedDesc')
                                  : t('userSettings.penalizeDislikedDesc')}
                              </Typography>
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', ml: 0 }}
                        />

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="caption" color="text.secondary">
                          {t('userSettings.dislikedFooter')}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Similarity Graph Preferences */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <HubOutlinedIcon color="primary" />
                      <Typography variant="h6">
                        {t('userSettings.similarityGraphPrefsTitle')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      {t('userSettings.similarityGraphPrefsSubtitle')}
                    </Typography>

                    {similarityPrefsSuccess && (
                      <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSimilarityPrefsSuccess(null)}>
                        {similarityPrefsSuccess}
                      </Alert>
                    )}

                    {loadingSimilarityPrefs ? (
                      <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress />
                      </Box>
                    ) : (
                      <>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={similarityHideWatched}
                              onChange={(e) => saveSimilarityPref('hideWatched', e.target.checked)}
                              disabled={savingSimilarityPrefs}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {t('userSettings.hideWatchedTitle')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {similarityHideWatched
                                  ? t('userSettings.hideWatchedOn')
                                  : t('userSettings.hideWatchedOff')}
                              </Typography>
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', ml: 0, mb: 2 }}
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={similarityFullFranchise}
                              onChange={(e) => saveSimilarityPref('fullFranchiseMode', e.target.checked)}
                              disabled={savingSimilarityPrefs}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {t('userSettings.fullFranchiseTitle')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {similarityFullFranchise
                                  ? t('userSettings.fullFranchiseOn')
                                  : t('userSettings.fullFranchiseOff')}
                              </Typography>
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', ml: 0 }}
                        />

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="caption" color="text.secondary">
                          {t('userSettings.similarityGraphFooter')}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Trakt Integration */}
              {traktStatus?.traktConfigured && (
                <Grid item xs={12} lg={6}>
                  <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Box
                      component="img"
                      src="/trakt.svg"
                      alt={t('userSettings.traktAlt')}
                      sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
                    />
                    <Typography variant="h6">
                      {t('userSettings.traktTitle')}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    {t('userSettings.traktSubtitle')}
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
                          {t('userSettings.traktConnectedAs', { username: traktStatus.username ?? '' })}
                        </Typography>
                        {traktStatus.syncedAt && (
                          <Typography variant="caption" color="text.secondary">
                            {t('userSettings.traktLastSynced', {
                              when: new Date(traktStatus.syncedAt).toLocaleString(),
                            })}
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
                          {syncingTrakt ? t('userSettings.traktSyncing') : t('userSettings.traktSyncRatings')}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={disconnectTrakt}
                          size="small"
                        >
                          {t('userSettings.traktDisconnect')}
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
                      {t('userSettings.traktConnect')}
                    </Button>
                  )}

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="caption" color="text.secondary">
                      {t('userSettings.traktFooter')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              )}
            </Grid>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}

