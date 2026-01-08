import React, { useState } from 'react'
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material'
import BuildIcon from '@mui/icons-material/Build'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TuneIcon from '@mui/icons-material/Tune'
import OutputIcon from '@mui/icons-material/Output'
import PsychologyIcon from '@mui/icons-material/Psychology'
import StorageIcon from '@mui/icons-material/Storage'
import ExtensionIcon from '@mui/icons-material/Extension'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  DatabaseSection,
  MediaServerSection,
  StrmSection,
  CostEstimatorSection,
  TextGenerationModelSection,
  ChatAssistantModelSection,
  TopPicksSection,
  AiExplanationSection,
  OutputFormatSection,
  LibraryTitlesSection,
  TraktConfigSection,
  OpenAIConfigSection,
} from './components'

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
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="AI Recommendations" />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Top Picks" />
          <Tab icon={<SmartToyIcon />} iconPosition="start" label="Chat Bot" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Setup Tab */}
          <TabPanel value={tabValue} index={0}>
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
              <Tab icon={<MenuBookIcon />} iconPosition="start" label="Docker Guide" />
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
              </Box>
            </TabPanel>

            {/* Integrations Sub-tab */}
            <TabPanel value={setupSubTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <OpenAIConfigSection />
                  <TraktConfigSection />
                </Box>
              </Box>
            </TabPanel>

            {/* Docker Guide Sub-tab */}
            <TabPanel value={setupSubTab} index={2}>
              <StrmSection />
            </TabPanel>
          </TabPanel>

          {/* AI Recommendations Tab */}
          <TabPanel value={tabValue} index={1}>
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
                <LibraryTitlesSection />
              </Box>
            </TabPanel>

            {/* AI Features Sub-tab */}
            <TabPanel value={aiSubTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <AiExplanationSection />
                <TextGenerationModelSection />
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
          <TabPanel value={tabValue} index={2}>
            <TopPicksSection />
          </TabPanel>

          {/* Chat Bot Tab */}
          <TabPanel value={tabValue} index={3}>
            <ChatAssistantModelSection />
          </TabPanel>

          {/* System Tab */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Cost Estimator */}
              <CostEstimatorSection
                movieCount={settings.embeddingConfig?.movieCount ?? settings.purgeStats?.movies ?? 0}
                seriesCount={settings.purgeStats?.series ?? 0}
                episodeCount={settings.purgeStats?.episodes ?? 0}
                enabledUserCount={1}
                embeddingModel={settings.embeddingConfig?.currentModel ?? 'text-embedding-3-large'}
              />

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
