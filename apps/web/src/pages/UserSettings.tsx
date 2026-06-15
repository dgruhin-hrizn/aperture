import React, { useCallback, useEffect, useState } from 'react'
import { Box, Grid, Paper, Tab, Tabs, Typography } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonIcon from '@mui/icons-material/Person'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import TuneIcon from '@mui/icons-material/Tune'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { WatcherIdentitySection } from './UserSettings/WatcherIdentitySection'
import { AlgorithmSettingsSection } from './UserSettings/AlgorithmSettingsSection'
import { UserLanguagePreferencesCard } from './UserSettings/UserLanguagePreferencesCard'
import { UserProfileTab } from './UserSettings/UserProfileTab'
import { AiLibraryNamesCard } from './UserSettings/AiLibraryNamesCard'
import { AiExplanationPreferenceCard } from './UserSettings/AiExplanationPreferenceCard'
import { SimilarityGraphPrefsCard } from './UserSettings/SimilarityGraphPrefsCard'
import { TraktIntegrationCard } from './UserSettings/TraktIntegrationCard'
import { useTraktIntegration } from './UserSettings/hooks/useTraktIntegration'
import { TabPanel } from './UserSettings/TabPanel'
import {
  userSettingsTabIndexFromParam,
  userSettingsTabParamFromIndex,
} from './UserSettings/tabHelpers'

export function UserSettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tabValue, setTabValue] = useState(() => userSettingsTabIndexFromParam(searchParams.get('tab')))
  const [identityMediaType, setIdentityMediaType] = useState<'movie' | 'series'>('movie')

  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [emailLocked, setEmailLocked] = useState(false)
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const {
    status: traktStatus,
    loading: loadingTrakt,
    syncing: syncingTrakt,
    message: traktMessage,
    setMessage: setTraktMessage,
    fetchStatus: fetchTraktStatus,
    connect: connectTrakt,
    disconnect: disconnectTrakt,
    syncRatings: syncTraktRatings,
    handleCallbackFromUrl: handleTraktCallbackFromUrl,
  } = useTraktIntegration()

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

  const fetchEmailSettings = useCallback(async () => {
    if (!user?.id) return
    setLoadingEmail(true)
    try {
      const response = await fetch(`/api/users/${user.id}/email-settings`, { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as {
          email?: string
          emailLocked?: boolean
          emailNotificationsEnabled?: boolean
        }
        const emailValue = data.email || ''
        setEmail(emailValue)
        setOriginalEmail(emailValue)
        setEmailLocked(data.emailLocked || false)
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
      }
    } catch {
      // Optional load failures may degrade gracefully
    } finally {
      setLoadingEmail(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchEmailSettings()
    void fetchTraktStatus()
    handleTraktCallbackFromUrl()
  }, [fetchEmailSettings, fetchTraktStatus, handleTraktCallbackFromUrl])

  const saveEmailSettings = async (newEmail?: string, newNotificationsEnabled?: boolean) => {
    if (!user?.id) return

    if (newEmail !== undefined && newEmail.trim() === originalEmail) {
      return
    }

    setSavingEmail(true)
    setEmailError(null)
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
        const data = (await response.json()) as {
          email?: string
          emailLocked?: boolean
          emailNotificationsEnabled?: boolean
        }
        const emailValue = data.email || ''
        setEmail(emailValue)
        setOriginalEmail(emailValue)
        setEmailLocked(data.emailLocked || false)
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
        setEmailSuccess(t('userSettings.emailSettingsSaved'))
        window.setTimeout(() => setEmailSuccess(null), 3000)
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        setEmailError(err.error || t('userSettings.errSaveSettings'))
      }
    } catch {
      setEmailError(t('userSettings.errConnectServer'))
    } finally {
      setSavingEmail(false)
    }
  }

  const identityAccentColor = identityMediaType === 'movie' ? '#6366f1' : '#ec4899'

  return (
    <Box>
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

      <Paper sx={{ backgroundColor: 'background.paper', borderRadius: 2 }} elevation={0}>
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
          <TabPanel value={tabValue} index={0}>
            <UserProfileTab
              user={user}
              email={email}
              originalEmail={originalEmail}
              emailLocked={emailLocked}
              emailNotificationsEnabled={emailNotificationsEnabled}
              loadingEmail={loadingEmail}
              savingEmail={savingEmail}
              emailSuccess={emailSuccess}
              emailError={emailError}
              onEmailChange={setEmail}
              onEmailBlur={() => void saveEmailSettings(email)}
              onNotificationsChange={(enabled) => {
                setEmailNotificationsEnabled(enabled)
                void saveEmailSettings(undefined, enabled)
              }}
              onDismissSuccess={() => setEmailSuccess(null)}
              onDismissEmailError={() => setEmailError(null)}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Tabs
              value={identityMediaType}
              onChange={(_, value: 'movie' | 'series') => setIdentityMediaType(value)}
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
            <WatcherIdentitySection mediaType={identityMediaType} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {user && <AlgorithmSettingsSection userId={user.id} />}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <UserLanguagePreferencesCard />
              </Grid>
              <Grid item xs={12} lg={6}>
                <AiLibraryNamesCard user={user} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <AiExplanationPreferenceCard />
              </Grid>
              <Grid item xs={12} lg={6}>
                <SimilarityGraphPrefsCard />
              </Grid>
              <Grid item xs={12} lg={6}>
                <TraktIntegrationCard
                  status={traktStatus}
                  loading={loadingTrakt}
                  syncing={syncingTrakt}
                  message={traktMessage}
                  onDismissMessage={() => setTraktMessage(null)}
                  onConnect={() => void connectTrakt()}
                  onDisconnect={() => void disconnectTrakt()}
                  onSync={() => void syncTraktRatings()}
                />
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}
