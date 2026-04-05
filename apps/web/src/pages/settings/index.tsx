import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  Typography,
} from '@mui/material'
import BuildIcon from '@mui/icons-material/Build'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import TuneIcon from '@mui/icons-material/Tune'
import OutputIcon from '@mui/icons-material/Output'
import PsychologyIcon from '@mui/icons-material/Psychology'
import StorageIcon from '@mui/icons-material/Storage'
import ExtensionIcon from '@mui/icons-material/Extension'
import HandymanIcon from '@mui/icons-material/Handyman'
import MemoryIcon from '@mui/icons-material/Memory'
import CategoryIcon from '@mui/icons-material/Category'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  DatabaseSection,
  MediaServerSection,
  FileLocationsSection,
  TopPicksSection,
  WatchingSection,
  AiExplanationSection,
  OutputFormatSection,
  LibraryTitlesSection,
  TraktConfigSection,
  AISetupSection,
  TMDbConfigSection,
  OMDbConfigSection,
  MDBListConfigSection,
  SeerrConfigSection,
  StreamingDiscoverySettings,
  DiscoveryGenreStripsSettings,
  BackupSection,
  PosterRepairSection,
  LegacyEmbeddingsSection,
  ApiKeysSection,
  LanguageDefaultsSection,
} from './components'
import { ApiErrorAlert } from '../../components/ApiErrorAlert'
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

const ADMIN_MAIN_TAB_KEYS = [
  'setup',
  'ai-llm',
  'ai-recs',
  'top-picks',
  'watching',
  'maintenance',
  'system',
] as const

function adminMainIndexFromParam(tab: string | null): number {
  if (!tab) return 0
  const idx = ADMIN_MAIN_TAB_KEYS.indexOf(tab as (typeof ADMIN_MAIN_TAB_KEYS)[number])
  return idx >= 0 ? idx : 0
}

function adminMainParamFromIndex(index: number): string {
  return ADMIN_MAIN_TAB_KEYS[index] ?? 'setup'
}

const SETUP_SUB_KEYS = ['media', 'integrations', 'genre-discovery'] as const
const AI_SUB_KEYS = ['output', 'features', 'algorithm'] as const

function setupSubIndexFromParam(p: string | null): number {
  if (p === 'integrations') return 1
  if (p === 'genre-discovery') return 2
  return 0
}

function setupSubParamFromIndex(index: number): string {
  return SETUP_SUB_KEYS[index] ?? 'media'
}

function aiSubIndexFromParam(p: string | null): number {
  if (p === 'features') return 1
  if (p === 'algorithm') return 2
  return 0
}

function aiSubParamFromIndex(index: number): string {
  return AI_SUB_KEYS[index] ?? 'output'
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tabValue, setTabValue] = useState(() => adminMainIndexFromParam(searchParams.get('tab')))
  const [setupSubTab, setSetupSubTab] = useState(() => setupSubIndexFromParam(searchParams.get('setupSub')))
  const [aiSubTab, setAiSubTab] = useState(() => aiSubIndexFromParam(searchParams.get('aiSub')))
  const [tmdbReady, setTmdbReady] = useState(false)
  const [tmdbConfigured, setTmdbConfigured] = useState(false)
  const settings = useSettingsData(true) // Admin-only page now

  const fetchTmdbStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/tmdb', { credentials: 'include' })
      if (!res.ok) {
        setTmdbConfigured(false)
        return
      }
      const data = (await res.json()) as { isConfigured?: boolean }
      setTmdbConfigured(Boolean(data.isConfigured))
    } catch {
      setTmdbConfigured(false)
    } finally {
      setTmdbReady(true)
    }
  }, [])

  useEffect(() => {
    void fetchTmdbStatus()
  }, [fetchTmdbStatus])

  useEffect(() => {
    setTabValue(adminMainIndexFromParam(searchParams.get('tab')))
    setSetupSubTab(setupSubIndexFromParam(searchParams.get('setupSub')))
    setAiSubTab(aiSubIndexFromParam(searchParams.get('aiSub')))
  }, [searchParams])

  useEffect(() => {
    if (!tmdbReady || tmdbConfigured) return
    if (setupSubTab !== 2) return
    setSetupSubTab(1)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('setupSub', 'integrations')
        return next
      },
      { replace: true }
    )
  }, [tmdbReady, tmdbConfigured, setupSubTab, setSearchParams])

  const updateAdminSettingsParams = (updates: Record<string, string | null>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, val] of Object.entries(updates)) {
          if (val === null) next.delete(key)
          else next.set(key, val)
        }
        return next
      },
      { replace: true }
    )
  }

  const handleMainTabChange = (_: React.SyntheticEvent, v: number) => {
    setTabValue(v)
    updateAdminSettingsParams({ tab: adminMainParamFromIndex(v) })
  }

  const handleSetupSubChange = (_: React.SyntheticEvent, v: number) => {
    setSetupSubTab(v)
    updateAdminSettingsParams({ setupSub: setupSubParamFromIndex(v) })
    if (v === 1 || v === 2) void fetchTmdbStatus()
  }

  const handleAiSubChange = (_: React.SyntheticEvent, v: number) => {
    setAiSubTab(v)
    updateAdminSettingsParams({ aiSub: aiSubParamFromIndex(v) })
  }

  return (
    <Box>
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
          variant="scrollable"
          scrollButtons="auto"
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
          <Tab icon={<BuildIcon />} iconPosition="start" label={t('settingsPage.tabSetup')} />
          <Tab icon={<MemoryIcon />} iconPosition="start" label={t('settingsPage.tabAiLlm')} />
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label={t('settingsPage.tabAiRecs')} />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label={t('settingsPage.tabTopPicks')} />
          <Tab icon={<AddToQueueIcon />} iconPosition="start" label={t('settingsPage.tabWatching')} />
          <Tab icon={<HandymanIcon />} iconPosition="start" label={t('settingsPage.tabMaintenance')} />
          <Tab icon={<SettingsIcon />} iconPosition="start" label={t('settingsPage.tabSystem')} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Setup Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/setup', { state: { from: '/admin/settings' } })}>
                {t('settingsPage.rerunSetup')}
              </Button>
            </Box>
            {/* Sub-tabs for Setup */}
            <Tabs
              value={setupSubTab}
              onChange={handleSetupSubChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                mb: 3,
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                },
              }}
            >
              <Tab icon={<StorageIcon />} iconPosition="start" label={t('settingsPage.subMediaServer')} />
              <Tab icon={<ExtensionIcon />} iconPosition="start" label={t('settingsPage.subIntegrations')} />
              <Tab
                icon={<CategoryIcon />}
                iconPosition="start"
                label={t('settingsPage.subGenreDiscovery')}
                disabled={!tmdbReady || !tmdbConfigured}
                title={
                  tmdbReady && !tmdbConfigured
                    ? t('settingsPage.genreDiscoveryTabDisabled')
                    : undefined
                }
              />
            </Tabs>

            {/* Media Server Sub-tab */}
            <TabPanel value={setupSubTab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <MediaServerSection />
                  <LibraryConfigSection
                    libraries={settings.libraries}
                    loadingLibraries={settings.loadingLibraries}
                    syncingLibraries={settings.syncingLibraries}
                    libraryError={settings.libraryError}
                    updatingLibrary={settings.updatingLibrary}
                    onSync={settings.syncLibrariesFromServer}
                    onToggle={settings.toggleLibraryEnabled}
                  />
                </Box>
                <FileLocationsSection />
              </Box>
            </TabPanel>

            {/* Integrations Sub-tab */}
            <TabPanel value={setupSubTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* API Error Alerts */}
                <ApiErrorAlert maxErrors={5} />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <TraktConfigSection />
                  <TMDbConfigSection />
                  <OMDbConfigSection />
                  <MDBListConfigSection />
                  <SeerrConfigSection />
                </Box>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <StreamingDiscoverySettings />
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={setupSubTab} index={2}>
              {!tmdbReady ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                  <Typography color="text.secondary">{t('settingsPage.genreDiscoveryLoading')}</Typography>
                </Box>
              ) : !tmdbConfigured ? (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  {t('settingsPage.genreDiscoveryRequiresTmdb')}
                </Typography>
              ) : (
                <DiscoveryGenreStripsSettings />
              )}
            </TabPanel>

          </TabPanel>

          {/* AI / LLM Tab */}
          <TabPanel value={tabValue} index={1}>
            <AISetupSection />
          </TabPanel>

          {/* AI Recommendations Tab */}
          <TabPanel value={tabValue} index={2}>
            {/* Sub-tabs for AI Recommendations */}
            <Tabs
              value={aiSubTab}
              onChange={handleAiSubChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                mb: 3,
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                },
              }}
            >
              <Tab icon={<OutputIcon />} iconPosition="start" label={t('settingsPage.subOutput')} />
              <Tab icon={<PsychologyIcon />} iconPosition="start" label={t('settingsPage.subAiFeatures')} />
              <Tab icon={<TuneIcon />} iconPosition="start" label={t('settingsPage.subAlgorithm')} />
            </Tabs>

            {/* Output Sub-tab */}
            <TabPanel value={aiSubTab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <OutputFormatSection />
                <LibraryTitlesSection />
              </Box>
            </TabPanel>

            {/* AI Features Sub-tab */}
            <TabPanel value={aiSubTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <AiExplanationSection />
              </Box>
            </TabPanel>

            {/* Algorithm Sub-tab */}
            <TabPanel value={aiSubTab} index={2}>
              <RecommendationConfigSection
                recConfig={settings.recConfig}
                loadingRecConfig={settings.loadingRecConfig}
                savingRecConfig={settings.savingRecConfig}
                recConfigError={settings.recConfigError}
                setRecConfigError={settings.setRecConfigError}
                recConfigSuccess={settings.recConfigSuccess}
                setRecConfigSuccess={settings.setRecConfigSuccess}
                movieConfigDirty={settings.movieConfigDirty}
                seriesConfigDirty={settings.seriesConfigDirty}
                saveMovieConfig={settings.saveMovieConfig}
                saveSeriesConfig={settings.saveSeriesConfig}
                resetMovieConfig={settings.resetMovieConfig}
                resetSeriesConfig={settings.resetSeriesConfig}
                updateMovieConfigField={settings.updateMovieConfigField}
                updateSeriesConfigField={settings.updateSeriesConfigField}
              />
            </TabPanel>
          </TabPanel>

          {/* Top Picks Tab */}
          <TabPanel value={tabValue} index={3}>
            <TopPicksSection />
          </TabPanel>

          {/* Shows You Watch Tab */}
          <TabPanel value={tabValue} index={4}>
            <WatchingSection />
          </TabPanel>

          {/* Maintenance Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <LegacyEmbeddingsSection />
              <PosterRepairSection />
            </Box>
          </TabPanel>

          {/* System Tab */}
          <TabPanel value={tabValue} index={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <LanguageDefaultsSection />
              {/* API Keys */}
              <ApiKeysSection />

              {/* Database Backup & Restore */}
              <BackupSection />

              {/* Database Management - Danger Zone */}
              <DatabaseSection
                purgeStats={settings.purgeStats}
                loadingPurgeStats={settings.loadingPurgeStats}
                purging={settings.purging}
                purgeError={settings.purgeError}
                setPurgeError={settings.setPurgeError}
                purgeSuccess={settings.purgeSuccess}
                setPurgeSuccess={settings.setPurgeSuccess}
                showPurgeConfirm={settings.showPurgeConfirm}
                setShowPurgeConfirm={settings.setShowPurgeConfirm}
                onPurge={settings.executePurge}
              />
            </Box>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}
