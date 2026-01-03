import React, { useState } from 'react'
import { Box, Tabs, Tab, Paper } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import PsychologyIcon from '@mui/icons-material/Psychology'
import SettingsIcon from '@mui/icons-material/Settings'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  EmbeddingsSection,
  DatabaseSection,
  MediaServerSection,
  StrmSection,
  CostEstimatorSection,
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
            <LibraryConfigSection
              libraries={settings.libraries}
              loadingLibraries={settings.loadingLibraries}
              syncingLibraries={settings.syncingLibraries}
              libraryError={settings.libraryError}
              updatingLibrary={settings.updatingLibrary}
              onSync={settings.syncLibrariesFromServer}
              onToggle={settings.toggleLibraryEnabled}
            />
          </TabPanel>

          {/* AI Config Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <RecommendationConfigSection
                recConfig={settings.recConfig}
                loadingRecConfig={settings.loadingRecConfig}
                savingRecConfig={settings.savingRecConfig}
                recConfigError={settings.recConfigError}
                setRecConfigError={settings.setRecConfigError}
                recConfigSuccess={settings.recConfigSuccess}
                setRecConfigSuccess={settings.setRecConfigSuccess}
                recConfigDirty={settings.recConfigDirty}
                onSave={settings.saveRecConfig}
                onReset={settings.resetRecConfig}
                onUpdateField={settings.updateRecConfigField}
              />
              
              <EmbeddingsSection
                embeddingConfig={settings.embeddingConfig}
                loadingEmbeddingModel={settings.loadingEmbeddingModel}
              />

              <CostEstimatorSection
                movieCount={settings.embeddingConfig?.movieCount ?? settings.purgeStats?.movies ?? 0}
                enabledUserCount={1}
                embeddingModel={settings.embeddingConfig?.currentModel ?? 'text-embedding-3-large'}
              />
            </Box>
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
