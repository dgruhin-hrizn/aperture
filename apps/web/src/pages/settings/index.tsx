import React, { useState } from 'react'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material'
import BuildIcon from '@mui/icons-material/Build'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TuneIcon from '@mui/icons-material/Tune'
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
  AiExplanationSection,
  OutputFormatSection,
  LibraryTitlesSection,
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
  const [advancedExpanded, setAdvancedExpanded] = useState(false)
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
          <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Setup Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Media Server & Libraries side by side */}
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

              {/* STRM/Symlink Documentation */}
              <Accordion
                sx={{
                  backgroundColor: 'background.paper',
                  '&:before': { display: 'none' },
                  boxShadow: 1,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Docker & Volume Setup Guide
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <StrmSection />
                </AccordionDetails>
              </Accordion>
            </Box>
          </TabPanel>

          {/* AI Recommendations Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Main Settings - Always Visible */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                <OutputFormatSection />
                <LibraryTitlesSection />
              </Box>

              <AiExplanationSection />

              {/* Advanced Settings - Collapsed */}
              <Accordion
                expanded={advancedExpanded}
                onChange={(_, expanded) => setAdvancedExpanded(expanded)}
                sx={{
                  backgroundColor: 'background.paper',
                  '&:before': { display: 'none' },
                  boxShadow: 1,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TuneIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Advanced Settings
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextGenerationModelSection />
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
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          </TabPanel>

          {/* Top Picks Tab */}
          <TabPanel value={tabValue} index={2}>
            <TopPicksSection />
          </TabPanel>

          {/* System Tab */}
          <TabPanel value={tabValue} index={3}>
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
