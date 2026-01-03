import React, { useState } from 'react'
import { Box, Typography, Chip, Alert, Stack, Tabs, Tab } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useJobsData } from './hooks'
import { MOVIE_JOB_CATEGORIES, SERIES_JOB_CATEGORIES, GLOBAL_JOB_CATEGORIES } from './constants'
import { JobCard, JobConfigDialog, JobHistoryDialog, CancelDialog, LoadingSkeleton } from './components'
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
              gridTemplateColumns="repeat(auto-fill, minmax(360px, 1fr))"
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

