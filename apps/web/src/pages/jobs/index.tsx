import React, { useState } from 'react'
import { Box, Typography, Chip, Alert, Stack, Tabs, Tab, Paper, Button, CircularProgress } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ScheduleIcon from '@mui/icons-material/Schedule'
import BuildIcon from '@mui/icons-material/Build'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useJobsData } from './hooks'
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
}

function JobCategoryList({
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
}: JobCategoryListProps) {
  return (
    <Stack spacing={5}>
      {categories.map((category) => {
        const categoryJobs = jobs.filter((j) => category.jobs.includes(j.name))
        if (categoryJobs.length === 0) return null

        return (
          <Box key={category.title}>
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
                {category.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            </Box>

            {/* Job Cards Grid */}
            <Box
              display="grid"
              gridTemplateColumns="repeat(auto-fill, minmax(500px, 1fr))"
              gap={2.5}
            >
              {categoryJobs.map((job) => (
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
                />
              ))}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

// Maintenance section with reset enrichment and other admin tasks
function MaintenanceSection({ onRunJob }: { onRunJob: (name: string) => void }) {
  const [resettingEnrichment, setResettingEnrichment] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleResetEnrichment = async () => {
    setResettingEnrichment(true)
    setResetMessage(null)
    
    try {
      const response = await fetch('/api/admin/reset-enrichment', {
        method: 'POST',
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to reset enrichment')
      }
      
      setResetMessage({ 
        type: 'success', 
        text: 'Enrichment reset successfully. Run the "Enrich Metadata" job to re-fetch all metadata.' 
      })
    } catch {
      setResetMessage({ type: 'error', text: 'Failed to reset enrichment. Please try again.' })
    } finally {
      setResettingEnrichment(false)
    }
  }

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Database Maintenance
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administrative tools for managing your Aperture database. Use with caution.
        </Typography>
      </Box>

      {resetMessage && (
        <Alert 
          severity={resetMessage.type} 
          onClose={() => setResetMessage(null)}
          sx={{ borderRadius: 2 }}
        >
          {resetMessage.text}
        </Alert>
      )}

      {/* Reset Enrichment */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Reset Metadata Enrichment
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Forces a complete re-fetch of metadata for all movies and series from TMDb, OMDb, and MDBList.
            </Typography>
          </Box>
          
          <Alert severity="info" sx={{ borderRadius: 1.5 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              Note: Normally not needed
            </Typography>
            <Typography variant="body2">
              The enrichment job automatically updates items when new metadata fields are added 
              (via the enrichment version system). Use this only if you want to force a complete refresh 
              of all ratings, keywords, and metadata.
            </Typography>
          </Alert>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={resettingEnrichment ? <CircularProgress size={18} /> : <RefreshIcon />}
              onClick={handleResetEnrichment}
              disabled={resettingEnrichment}
            >
              {resettingEnrichment ? 'Resetting...' : 'Force Full Reset'}
            </Button>
            
            <Button
              variant="contained"
              onClick={() => onRunJob('enrich-metadata')}
              disabled={resettingEnrichment}
            >
              Run Enrichment Job
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  )
}

export function JobsPage() {
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

  const [tabValue, setTabValue] = useState(0)
  const [configDialogJob, setConfigDialogJob] = useState<string | null>(null)
  const [historyDialogJob, setHistoryDialogJob] = useState<string | null>(null)
  const configJob = jobs.find((j) => j.name === configDialogJob)

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
            Background Jobs
          </Typography>
          {runningCount > 0 && (
            <Chip
              label={`${runningCount} running`}
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
          Manage syncing, AI processing, and system maintenance tasks
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab
          icon={<MovieIcon />}
          iconPosition="start"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <span>Movies</span>
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
              <span>TV Series</span>
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
              <span>Global</span>
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
          label="Schedule"
        />
        <Tab
          icon={<BuildIcon />}
          iconPosition="start"
          label="Maintenance"
        />
      </Tabs>

      {/* Movies Tab */}
      <TabPanel value={tabValue} index={0}>
        <JobCategoryList
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
        />
      </TabPanel>

      {/* Schedule Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box mb={3}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Job Schedules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure when each job runs automatically. Disabled jobs will only run when manually triggered.
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

      {/* Maintenance Tab */}
      <TabPanel value={tabValue} index={4}>
        <MaintenanceSection onRunJob={handleRunJob} />
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

