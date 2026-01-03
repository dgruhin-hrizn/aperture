import React from 'react'
import { Box, Button, Collapse, Stack, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { JOB_ICONS, JOB_COLORS, formatJobName, formatCron } from '../constants'
import { JobProgressSection } from './JobProgressSection'
import { JobResult } from './JobResult'
import type { Job, JobProgress } from '../types'

interface JobCardProps {
  job: Job
  progress: JobProgress | undefined
  logsExpanded: boolean
  isCancelling: boolean
  onRun: () => void
  onCancel: () => void
  onToggleLogs: () => void
  logsContainerRef: (el: HTMLDivElement | null) => void
}

export function JobCard({
  job,
  progress,
  logsExpanded,
  isCancelling,
  onRun,
  onCancel,
  onToggleLogs,
  logsContainerRef,
}: JobCardProps) {
  const isRunning = job.status === 'running' || progress?.status === 'running'
  const jobColor = JOB_COLORS[job.name] || '#666'
  const showResult =
    !isRunning &&
    progress &&
    (progress.status === 'completed' ||
      progress.status === 'failed' ||
      progress.status === 'cancelled')

  return (
    <Box
      sx={{
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: isRunning ? `${jobColor}55` : 'divider',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        ...(isRunning && {
          boxShadow: `0 0 20px ${jobColor}22`,
        }),
      }}
    >
      {/* Card Header */}
      <Box
        sx={{
          p: 2.5,
          background: isRunning
            ? `linear-gradient(135deg, ${jobColor}15 0%, transparent 100%)`
            : 'transparent',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Icon */}
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: `${jobColor}18`,
              color: jobColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {JOB_ICONS[job.name]}
          </Box>

          {/* Content */}
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {formatJobName(job.name)}
              </Typography>
              {isRunning && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: jobColor,
                    animation: 'pulse 1.5s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {job.description}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled">
                {formatCron(job.cron)}
              </Typography>
            </Stack>
          </Box>

          {/* Action Button */}
          <Box>
            {isRunning ? (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={isCancelling ? null : <StopIcon />}
                onClick={onCancel}
                disabled={isCancelling}
                sx={{
                  borderColor: 'error.main',
                  minWidth: 90,
                  '&:hover': {
                    bgcolor: 'error.dark',
                    borderColor: 'error.dark',
                    color: 'white',
                  },
                }}
              >
                {isCancelling ? 'Stopping...' : 'Stop'}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={onRun}
                sx={{
                  bgcolor: jobColor,
                  minWidth: 90,
                  '&:hover': {
                    bgcolor: jobColor,
                    filter: 'brightness(1.15)',
                  },
                }}
              >
                Run
              </Button>
            )}
          </Box>
        </Stack>
      </Box>

      {/* Running State - Progress Section */}
      <Collapse in={isRunning && !!progress}>
        {progress && (
          <JobProgressSection
            progress={progress}
            jobColor={jobColor}
            logsExpanded={logsExpanded}
            onToggleLogs={onToggleLogs}
            logsContainerRef={logsContainerRef}
          />
        )}
      </Collapse>

      {/* Completed/Failed/Cancelled State */}
      <Collapse in={showResult}>{progress && showResult && <JobResult progress={progress} />}</Collapse>
    </Box>
  )
}

