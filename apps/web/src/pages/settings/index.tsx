import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
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
  JellyseerrConfigSection,
  BackupSection,
  PosterRepairSection,
  LegacyEmbeddingsSection,
  PreventDuplicatesSection,
} from './components'
import { ApiErrorAlert } from '../../components/ApiErrorAlert'

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

export function SettingsPage() {
  const navigate = useNavigate()
  const [tabValue, setTabValue] = useState(0)
  const [setupSubTab, setSetupSubTab] = useState(0)
  const [aiSubTab, setAiSubTab] = useState(0)
  const settings = useSettingsData(true) // Admin-only page now

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
          onChange={(_, v) => setTabValue(v)}
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
          <Tab icon={<BuildIcon />} iconPosition="start" label="Setup" />
          <Tab icon={<MemoryIcon />} iconPosition="start" label="AI / LLM" />
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="AI Recommendations" />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Top Picks" />
          <Tab icon={<AddToQueueIcon />} iconPosition="start" label="Shows You Watch" />
          <Tab icon={<HandymanIcon />} iconPosition="start" label="Maintenance" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Setup Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/setup', { state: { from: '/admin/settings' } })}>
                Re-run Setup Wizard
              </Button>
            </Box>
            {/* Sub-tabs for Setup */}
            <Tabs
              value={setupSubTab}
              onChange={(_, v) => setSetupSubTab(v)}
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
              <Tab icon={<StorageIcon />} iconPosition="start" label="Media Server" />
              <Tab icon={<ExtensionIcon />} iconPosition="start" label="Integrations" />
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
                  <JellyseerrConfigSection />
                </Box>
              </Box>
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
              onChange={(_, v) => setAiSubTab(v)}
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
              <Tab icon={<OutputIcon />} iconPosition="start" label="Output" />
              <Tab icon={<PsychologyIcon />} iconPosition="start" label="AI Features" />
              <Tab icon={<TuneIcon />} iconPosition="start" label="Algorithm" />
            </Tabs>

            {/* Output Sub-tab */}
            <TabPanel value={aiSubTab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <OutputFormatSection />
                <PreventDuplicatesSection />
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
