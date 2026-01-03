import React, { useState } from 'react'
import { Box, Typography, Chip, Alert, Stack } from '@mui/material'
import { useJobsData } from './hooks'
import { JOB_CATEGORIES } from './constants'
import { JobCard, JobConfigDialog, CancelDialog, LoadingSkeleton } from './components'

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

  const [configDialogJob, setConfigDialogJob] = useState<string | null>(null)
  const configJob = jobs.find((j) => j.name === configDialogJob)

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
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
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Job Categories */}
      <Stack spacing={5}>
        {JOB_CATEGORIES.map((category) => {
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
                    onRun={() => handleRunJob(job.name)}
                    onCancel={() => setCancelDialogJob(job.name)}
                    onToggleLogs={() => toggleLogs(job.name)}
                    onConfigClick={() => setConfigDialogJob(job.name)}
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
    </Box>
  )
}

