import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Box, Typography, Chip, Alert, Stack, Tabs, Tab, Button, AlertTitle } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ScheduleIcon from '@mui/icons-material/Schedule'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useJobsData, useEnrichmentStatus, useDiscoveryPrerequisites } from './hooks'
import { MOVIE_JOB_CATEGORIES, SERIES_JOB_CATEGORIES, GLOBAL_JOB_CATEGORIES } from './constants'
import { JobCard, JobConfigDialog, JobHistoryDialog, CancelDialog, LoadingSkeleton, ScheduleTable } from './components'
import type { JobCategory } from './types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box pt={3}>{children}</Box>}
    </div>
  )
}

interface JobCategoryListProps {
  t: TFunction
  categories: JobCategory[]
  jobs: ReturnType<typeof useJobsData>['jobs']
  jobProgress: ReturnType<typeof useJobsData>['jobProgress']
  expandedLogs: ReturnType<typeof useJobsData>['expandedLogs']
  cancellingJobs: ReturnType<typeof useJobsData>['cancellingJobs']
  logsContainerRefs: ReturnType<typeof useJobsData>['logsContainerRefs']
  onRunJob: (name: string) => void
  onCancelJob: (name: string) => void
  onToggleLogs: (name: string) => void
  onConfigClick: (name: string) => void
  onHistoryClick: (name: string) => void
  discoveryReady?: boolean
  discoveryMessage?: string | null
}

function JobCategoryList({
  t,
  categories,
  jobs,
  jobProgress,
  expandedLogs,
  cancellingJobs,
  logsContainerRefs,
  onRunJob,
  onCancelJob,
  onToggleLogs,
  onConfigClick,
  onHistoryClick,
  discoveryReady,
  discoveryMessage,
}: JobCategoryListProps) {
  return (
    <Stack spacing={5}>
      {categories.map((category) => {
        const categoryJobs = jobs.filter((j) => category.jobs.includes(j.name))
        if (categoryJobs.length === 0) return null

        return (
          <Box key={category.titleKey}>
            {/* Category Header */}
            <Box mb={2.5}>
              <Typography
                variant="overline"
                sx={{
                  color: category.color,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                }}
              >
                {t(category.titleKey)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(category.descriptionKey)}
              </Typography>
            </Box>

            {/* Job Cards Grid */}
            <Box
              display="grid"
              gridTemplateColumns={{
                xs: '1fr',
                sm: 'repeat(auto-fill, minmax(400px, 1fr))',
                lg: 'repeat(auto-fill, minmax(500px, 1fr))',
              }}
              gap={2.5}
            >
              {categoryJobs.map((job) => {
                // Check if this is the discovery job and apply disabled state
                const isDiscoveryJob = job.name === 'generate-discovery-suggestions'
                const isDisabled = isDiscoveryJob && discoveryReady === false
                
                return (
                  <JobCard
                    key={job.name}
                    job={job}
                    progress={jobProgress.get(job.name)}
                    logsExpanded={expandedLogs.has(job.name)}
                    isCancelling={cancellingJobs.has(job.name)}
                    onRun={() => onRunJob(job.name)}
                    onCancel={() => onCancelJob(job.name)}
                    onToggleLogs={() => onToggleLogs(job.name)}
                    onConfigClick={() => onConfigClick(job.name)}
                    onHistoryClick={() => onHistoryClick(job.name)}
                    logsContainerRef={(el) => {
                      if (el) logsContainerRefs.current.set(job.name, el)
                    }}
                    disabled={isDisabled}
                    disabledMessage={isDisabled ? discoveryMessage ?? undefined : undefined}
                  />
                )
              })}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

export function JobsPage() {
  const { t } = useTranslation()
  const {
    jobs,
    loading,
    error,
    jobProgress,
    expandedLogs,
    cancelDialogJob,
    cancellingJobs,
    logsContainerRefs,
    runningCount,
    handleRunJob,
    handleCancelJob,
    handleUpdateConfig,
    toggleLogs,
    setCancelDialogJob,
  } = useJobsData()

  const {
    status: enrichmentStatus,
    clearInterruptedRun,
    refresh: refreshEnrichmentStatus,
  } = useEnrichmentStatus()

  const { prerequisites: discoveryPrerequisites } = useDiscoveryPrerequisites()

  const [tabValue, setTabValue] = useState(0)
  const [configDialogJob, setConfigDialogJob] = useState<string | null>(null)
  const [historyDialogJob, setHistoryDialogJob] = useState<string | null>(null)
  const [clearingInterrupted, setClearingInterrupted] = useState(false)
  const configJob = jobs.find((j) => j.name === configDialogJob)

  // Handle clearing interrupted enrichment run
  const handleClearInterrupted = async () => {
    setClearingInterrupted(true)
    try {
      await clearInterruptedRun()
    } finally {
      setClearingInterrupted(false)
    }
  }

  // Handle running enrichment to resume from interrupted state
  const handleResumeEnrichment = async () => {
    setClearingInterrupted(true)
    try {
      await clearInterruptedRun()
      await handleRunJob('enrich-metadata')
    } finally {
      setClearingInterrupted(false)
    }
  }

  // Count running jobs per tab
  const movieJobNames = MOVIE_JOB_CATEGORIES.flatMap((c) => c.jobs)
  const seriesJobNames = SERIES_JOB_CATEGORIES.flatMap((c) => c.jobs)
  const globalJobNames = GLOBAL_JOB_CATEGORIES.flatMap((c) => c.jobs)
  const runningMovieJobs = jobs.filter(
    (j) => movieJobNames.includes(j.name) && j.status === 'running'
  ).length
  const runningSeriesJobs = jobs.filter(
    (j) => seriesJobNames.includes(j.name) && j.status === 'running'
  ).length
  const runningGlobalJobs = jobs.filter(
    (j) => globalJobNames.includes(j.name) && j.status === 'running'
  ).length

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" fontWeight={700}>
            {t('admin.jobsPage.title')}
          </Typography>
          {runningCount > 0 && (
            <Chip
              label={t('admin.jobsPage.runningChip', { count: runningCount })}
              size="small"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            />
          )}
        </Stack>
        <Typography variant="body1" color="text.secondary">
          {t('admin.jobsPage.subtitle')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Interrupted Enrichment Run Alert */}
      {enrichmentStatus?.hasIncompleteRun && enrichmentStatus.run && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleResumeEnrichment}
                disabled={clearingInterrupted}
              >
                {t('admin.jobsPage.resume')}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={handleClearInterrupted}
                disabled={clearingInterrupted}
              >
                {t('admin.jobsPage.dismiss')}
              </Button>
            </Stack>
          }
        >
          <AlertTitle>{t('admin.jobsPage.enrichmentTitle')}</AlertTitle>
          {t('admin.jobsPage.enrichmentBody1')}{' '}
          {enrichmentStatus.remainingMovies + enrichmentStatus.remainingSeries > 0 && (
            <>
              {t('admin.jobsPage.enrichmentRemaining', {
                movies: enrichmentStatus.remainingMovies,
                series: enrichmentStatus.remainingSeries,
              })}{' '}
            </>
          )}
          {enrichmentStatus.run.processed_movies + enrichmentStatus.run.processed_series > 0 && (
            <>
              {t('admin.jobsPage.enrichmentCompletedBefore', {
                movies: enrichmentStatus.run.processed_movies,
                series: enrichmentStatus.run.processed_series,
              })}{' '}
            </>
          )}
          {t('admin.jobsPage.enrichmentFooter')}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab
          icon={<MovieIcon />}
          iconPosition="start"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <span>{t('admin.jobsPage.tabMovies')}</span>
              {runningMovieJobs > 0 && (
                <Chip
                  label={runningMovieJobs}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Stack>
          }
        />
        <Tab
          icon={<TvIcon />}
          iconPosition="start"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <span>{t('admin.jobsPage.tabSeries')}</span>
              {runningSeriesJobs > 0 && (
                <Chip
                  label={runningSeriesJobs}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Stack>
          }
        />
        <Tab
          icon={<TrendingUpIcon />}
          iconPosition="start"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <span>{t('admin.jobsPage.tabGlobal')}</span>
              {runningGlobalJobs > 0 && (
                <Chip
                  label={runningGlobalJobs}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Stack>
          }
        />
        <Tab
          icon={<ScheduleIcon />}
          iconPosition="start"
          label={t('admin.jobsPage.tabSchedule')}
        />
      </Tabs>

      {/* Movies Tab */}
      <TabPanel value={tabValue} index={0}>
        <JobCategoryList
          t={t}
          categories={MOVIE_JOB_CATEGORIES}
          jobs={jobs}
          jobProgress={jobProgress}
          expandedLogs={expandedLogs}
          cancellingJobs={cancellingJobs}
          logsContainerRefs={logsContainerRefs}
          onRunJob={handleRunJob}
          onCancelJob={setCancelDialogJob}
          onToggleLogs={toggleLogs}
          onConfigClick={setConfigDialogJob}
          onHistoryClick={setHistoryDialogJob}
        />
      </TabPanel>

      {/* TV Series Tab */}
      <TabPanel value={tabValue} index={1}>
        <JobCategoryList
          t={t}
          categories={SERIES_JOB_CATEGORIES}
          jobs={jobs}
          jobProgress={jobProgress}
          expandedLogs={expandedLogs}
          cancellingJobs={cancellingJobs}
          logsContainerRefs={logsContainerRefs}
          onRunJob={handleRunJob}
          onCancelJob={setCancelDialogJob}
          onToggleLogs={toggleLogs}
          onConfigClick={setConfigDialogJob}
          onHistoryClick={setHistoryDialogJob}
        />
      </TabPanel>

      {/* Global Tab */}
      <TabPanel value={tabValue} index={2}>
        <JobCategoryList
          t={t}
          categories={GLOBAL_JOB_CATEGORIES}
          jobs={jobs}
          jobProgress={jobProgress}
          expandedLogs={expandedLogs}
          cancellingJobs={cancellingJobs}
          logsContainerRefs={logsContainerRefs}
          onRunJob={handleRunJob}
          onCancelJob={setCancelDialogJob}
          onToggleLogs={toggleLogs}
          onConfigClick={setConfigDialogJob}
          onHistoryClick={setHistoryDialogJob}
          discoveryReady={discoveryPrerequisites?.ready}
          discoveryMessage={discoveryPrerequisites?.message}
        />
      </TabPanel>

      {/* Schedule Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box mb={3}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('admin.jobsPage.scheduleTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('admin.jobsPage.scheduleSubtitle')}
          </Typography>
        </Box>
        <ScheduleTable
          jobs={jobs}
          onConfigClick={setConfigDialogJob}
          onHistoryClick={setHistoryDialogJob}
          onRunJob={handleRunJob}
          onToggleEnabled={(jobName, enabled) => {
            handleUpdateConfig(jobName, { isEnabled: enabled })
          }}
        />
      </TabPanel>

      {/* Cancel Confirmation Dialog */}
      <CancelDialog
        jobName={cancelDialogJob}
        onClose={() => setCancelDialogJob(null)}
        onConfirm={() => cancelDialogJob && handleCancelJob(cancelDialogJob)}
      />

      {/* Job Configuration Dialog */}
      <JobConfigDialog
        open={!!configDialogJob}
        onClose={() => setConfigDialogJob(null)}
        jobName={configDialogJob || ''}
        currentSchedule={configJob?.schedule}
        manualOnly={configJob?.manualOnly}
        onSave={(config) => handleUpdateConfig(configDialogJob!, config)}
      />

      {/* Job History Dialog */}
      <JobHistoryDialog
        open={!!historyDialogJob}
        jobName={historyDialogJob}
        onClose={() => setHistoryDialogJob(null)}
      />
    </Box>
  )
}

