import React, { useState } from 'react'
import { Box, Tabs, Tab, Paper } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import PsychologyIcon from '@mui/icons-material/Psychology'
import SettingsIcon from '@mui/icons-material/Settings'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TuneIcon from '@mui/icons-material/Tune'
import PaymentsIcon from '@mui/icons-material/Payments'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  DatabaseSection,
  MediaServerSection,
  StrmSection,
  CostEstimatorSection,
  TextGenerationModelSection,
  TopPicksSection,
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
          <Tab icon={<FolderIcon />} iconPosition="start" label="Libraries" />
          <Tab icon={<PsychologyIcon />} iconPosition="start" label="AI Config" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Libraries Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <LibraryConfigSection
                libraries={settings.libraries}
                loadingLibraries={settings.loadingLibraries}
                syncingLibraries={settings.syncingLibraries}
                libraryError={settings.libraryError}
                updatingLibrary={settings.updatingLibrary}
                onSync={settings.syncLibrariesFromServer}
                onToggle={settings.toggleLibraryEnabled}
              />
              <TopPicksSection />
            </Box>
          </TabPanel>

          {/* AI Config Tab with Sub-Tabs */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 3 }}>
              <Tabs
                value={aiSubTab}
                onChange={(_, v) => setAiSubTab(v)}
                sx={{
                  minHeight: 40,
                  '& .MuiTab-root': {
                    minHeight: 40,
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    py: 1,
                  },
                  '& .MuiTabs-indicator': {
                    height: 2,
                  },
                }}
              >
                <Tab icon={<SmartToyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Models" />
                <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Algorithm" />
                <Tab icon={<PaymentsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Costs" />
              </Tabs>
            </Box>

            {/* Models Sub-Tab */}
            <TabPanel value={aiSubTab} index={0}>
              <TextGenerationModelSection />
            </TabPanel>

            {/* Algorithm Sub-Tab */}
            <TabPanel value={aiSubTab} index={1}>
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

            {/* Costs Sub-Tab */}
            <TabPanel value={aiSubTab} index={2}>
              <CostEstimatorSection
                movieCount={settings.embeddingConfig?.movieCount ?? settings.purgeStats?.movies ?? 0}
                seriesCount={settings.purgeStats?.series ?? 0}
                episodeCount={settings.purgeStats?.episodes ?? 0}
                enabledUserCount={1}
                embeddingModel={settings.embeddingConfig?.currentModel ?? 'text-embedding-3-large'}
              />
            </TabPanel>
          </TabPanel>

          {/* System Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                <MediaServerSection />
                <StrmSection />
              </Box>
              
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
