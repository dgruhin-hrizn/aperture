import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import BuildIcon from '@mui/icons-material/Build'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TuneIcon from '@mui/icons-material/Tune'
import OutputIcon from '@mui/icons-material/Output'
import PsychologyIcon from '@mui/icons-material/Psychology'
import StorageIcon from '@mui/icons-material/Storage'
import ExtensionIcon from '@mui/icons-material/Extension'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  DatabaseSection,
  MediaServerSection,
  CostEstimatorSection,
  TextGenerationModelSection,
  ChatAssistantModelSection,
  TopPicksSection,
  WatchingSection,
  AiExplanationSection,
  OutputFormatSection,
  LibraryTitlesSection,
  TraktConfigSection,
  OpenAIConfigSection,
  TMDbConfigSection,
  OMDbConfigSection,
  BackupSection,
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

type SetupStepId =
  | 'mediaServer'
  | 'mediaLibraries'
  | 'aiRecsLibraries'
  | 'users'
  | 'topPicksEnable'
  | 'topPicksOutput'
  | 'openai'
  | 'initialJobs'

interface SetupProgress {
  completedSteps: SetupStepId[]
  currentStep: SetupStepId | null
  completedAt: string | null
}

const wizardSteps: Array<{ id: SetupStepId; label: string }> = [
  { id: 'mediaServer', label: 'Connect Media Server' },
  { id: 'mediaLibraries', label: 'Select Libraries' },
  { id: 'aiRecsLibraries', label: 'AI Recs Libraries + Images' },
  { id: 'users', label: 'Enable Users' },
  { id: 'topPicksEnable', label: 'Enable Top Picks' },
  { id: 'topPicksOutput', label: 'Top Picks Output' },
  { id: 'openai', label: 'Connect OpenAI' },
  { id: 'initialJobs', label: 'Run Initial Jobs' },
]

export function SettingsPage() {
  const [tabValue, setTabValue] = useState(0)
  const [setupSubTab, setSetupSubTab] = useState(0)
  const [aiSubTab, setAiSubTab] = useState(0)
  const settings = useSettingsData(true) // Admin-only page now

  // Admin setup wizard dialog state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardLoading, setWizardLoading] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [wizardProgress, setWizardProgress] = useState<SetupProgress | null>(null)
  const [wizardActiveStep, setWizardActiveStep] = useState(0)
  const [jobRunning, setJobRunning] = useState(false)
  const [jobLogs, setJobLogs] = useState<string[]>([])

  const refreshWizard = useCallback(async () => {
    setWizardLoading(true)
    setWizardError(null)
    try {
      const res = await fetch('/api/admin/setup/progress', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load setup wizard state')
      setWizardProgress(data.progress)

      const completed = new Set<string>((data.progress?.completedSteps ?? []) as string[])
      const firstIncompleteIdx = wizardSteps.findIndex((s) => !completed.has(s.id))
      setWizardActiveStep(firstIncompleteIdx === -1 ? wizardSteps.length - 1 : firstIncompleteIdx)
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Failed to load setup wizard state')
    } finally {
      setWizardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (wizardOpen) {
      refreshWizard()
    }
  }, [wizardOpen, refreshWizard])

  const markWizardStepCompleted = useCallback(
    async (step: SetupStepId) => {
      try {
        const res = await fetch('/api/admin/setup/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ completedStep: step }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to update setup progress')
        await refreshWizard()
      } catch (err) {
        setWizardError(err instanceof Error ? err.message : 'Failed to update setup progress')
      }
    },
    [refreshWizard]
  )

  const resetWizard = useCallback(async () => {
    setWizardLoading(true)
    setWizardError(null)
    try {
      const res = await fetch('/api/admin/setup/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reset: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to reset setup progress')
      await refreshWizard()
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Failed to reset setup progress')
    } finally {
      setWizardLoading(false)
    }
  }, [refreshWizard])

  const wizardStepId = useMemo(
    () => wizardSteps[wizardActiveStep]?.id ?? wizardSteps[0].id,
    [wizardActiveStep]
  )

  const isStepCompleted = useCallback(
    (step: SetupStepId) => !!wizardProgress?.completedSteps?.includes(step),
    [wizardProgress]
  )

  const gotoSettingsArea = useCallback(
    (step: SetupStepId) => {
      // Setup tab
      if (step === 'mediaServer' || step === 'mediaLibraries') {
        setTabValue(0)
        setSetupSubTab(0)
        return
      }

      // Integrations tab for OpenAI
      if (step === 'openai') {
        setTabValue(0)
        setSetupSubTab(1)
        return
      }

      // AI output config + library titles/images
      if (step === 'aiRecsLibraries') {
        setTabValue(1)
        setAiSubTab(0)
        return
      }

      if (step === 'topPicksEnable' || step === 'topPicksOutput') {
        setTabValue(2)
        return
      }

      // users + initialJobs are separate admin pages; keep dialog guidance.
    },
    []
  )

  const runJobAndWait = useCallback(async (jobName: string) => {
    const startRes = await fetch(`/api/jobs/${jobName}/run`, { method: 'POST', credentials: 'include' })
    const startData = await startRes.json()
    if (!startRes.ok) throw new Error(startData?.error || `Failed to start ${jobName}`)
    const jobId = startData.jobId as string
    setJobLogs((l) => [...l, `Started ${jobName} (${jobId})`])

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const pRes = await fetch(`/api/jobs/progress/${jobId}`, { credentials: 'include' })
      const p = await pRes.json()
      if (!pRes.ok) throw new Error(p?.error || `Failed to fetch progress for ${jobName}`)
      if (p.status !== 'running') {
        if (p.status === 'failed') throw new Error(`Job ${jobName} failed: ${p.errorMessage || 'Unknown error'}`)
        setJobLogs((l) => [...l, `Finished ${jobName} (${p.status})`])
        return
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }, [])

  const runInitialJobs = useCallback(async () => {
    setJobRunning(true)
    setWizardError(null)
    setJobLogs([])
    try {
      await runJobAndWait('sync-movies')
      await runJobAndWait('sync-series')
      await runJobAndWait('sync-movie-watch-history')
      await runJobAndWait('sync-series-watch-history')
      await runJobAndWait('generate-movie-embeddings')
      await runJobAndWait('generate-series-embeddings')
      await runJobAndWait('generate-movie-recommendations')
      await runJobAndWait('generate-series-recommendations')
      await runJobAndWait('sync-movie-libraries')
      await runJobAndWait('sync-series-libraries')
      await markWizardStepCompleted('initialJobs')
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Failed to run initial jobs')
    } finally {
      setJobRunning(false)
    }
  }, [markWizardStepCompleted, runJobAndWait])

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
          <Tab icon={<AddToQueueIcon />} iconPosition="start" label="Shows You Watch" />
          <Tab icon={<SmartToyIcon />} iconPosition="start" label="Chat Bot" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="System" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Setup Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="outlined" onClick={() => setWizardOpen(true)}>
                Rerun Setup Wizard
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
              </Box>
            </TabPanel>

            {/* Integrations Sub-tab */}
            <TabPanel value={setupSubTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                  <OpenAIConfigSection />
                  <TraktConfigSection />
                  <TMDbConfigSection />
                  <OMDbConfigSection />
                </Box>
              </Box>
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

          {/* Shows You Watch Tab */}
          <TabPanel value={tabValue} index={3}>
            <WatchingSection />
          </TabPanel>

          {/* Chat Bot Tab */}
          <TabPanel value={tabValue} index={4}>
            <ChatAssistantModelSection />
          </TabPanel>

          {/* System Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Cost Estimator */}
              <CostEstimatorSection
                movieCount={settings.embeddingConfig?.movieCount ?? settings.purgeStats?.movies ?? 0}
                seriesCount={settings.purgeStats?.series ?? 0}
                episodeCount={settings.purgeStats?.episodes ?? 0}
                enabledUserCount={1}
                embeddingModel={settings.embeddingConfig?.currentModel ?? 'text-embedding-3-large'}
              />

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

      {/* Admin Setup Wizard Dialog */}
      <Dialog open={wizardOpen} onClose={() => setWizardOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Setup Wizard (Admin)</DialogTitle>
        <DialogContent dividers>
          {wizardError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {wizardError}
            </Alert>
          )}

          {wizardLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Stepper activeStep={wizardActiveStep} sx={{ mb: 3 }} alternativeLabel>
                {wizardSteps.map((s) => (
                  <Step key={s.id} completed={isStepCompleted(s.id)}>
                    <StepLabel>{s.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle1">
                  Current step: {wizardSteps[wizardActiveStep]?.label}
                </Typography>

                {wizardStepId !== 'initialJobs' ? (
                  <Alert severity="info">
                    Use the Admin Settings tabs to configure this step, then click “Mark step completed”.
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Run the initial jobs in order here. This uses the same job system as Admin → Jobs.
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={() => gotoSettingsArea(wizardStepId)}>
                    Go to related settings
                  </Button>

                  {wizardStepId !== 'initialJobs' ? (
                    <Button variant="contained" onClick={() => markWizardStepCompleted(wizardStepId)}>
                      Mark step completed
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={runInitialJobs} disabled={jobRunning}>
                      {jobRunning ? <CircularProgress size={20} /> : 'Run Initial Jobs'}
                    </Button>
                  )}

                  <Button
                    variant="outlined"
                    onClick={() => setWizardActiveStep((s) => Math.max(0, s - 1))}
                    disabled={wizardActiveStep === 0}
                  >
                    Back
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setWizardActiveStep((s) => Math.min(wizardSteps.length - 1, s + 1))}
                    disabled={wizardActiveStep === wizardSteps.length - 1}
                  >
                    Next
                  </Button>
                </Box>

                {jobLogs.length > 0 && (
                  <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 12, mt: 1 }}>
                    {jobLogs.join('\n')}
                  </Box>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetWizard} color="warning" disabled={wizardLoading}>
            Reset progress
          </Button>
          <Button onClick={() => setWizardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
