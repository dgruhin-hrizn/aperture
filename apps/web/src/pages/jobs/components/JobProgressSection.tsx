import React from 'react'
import { Box, Button, Chip, Collapse, LinearProgress, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { getElapsedTime } from '../constants'
import { JobLogs } from './JobLogs'
import type { JobProgress } from '../types'

interface JobProgressSectionProps {
  progress: JobProgress
  jobColor: string
  logsExpanded: boolean
  onToggleLogs: () => void
  logsContainerRef: (el: HTMLDivElement | null) => void
}

export function JobProgressSection({
  progress,
  jobColor,
  logsExpanded,
  onToggleLogs,
  logsContainerRef,
}: JobProgressSectionProps) {
  return (
    <Box
      sx={{
        px: 2.5,
        pb: 2.5,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Progress Info */}
      <Box py={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" fontWeight={500}>
            {progress.currentStep}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {getElapsedTime(progress.startedAt)}
            </Typography>
            <Chip
              label={`${progress.overallProgress}%`}
              size="small"
              sx={{
                bgcolor: `${jobColor}22`,
                color: jobColor,
                fontWeight: 700,
                minWidth: 52,
              }}
            />
          </Stack>
        </Stack>

        {/* Progress Bar */}
        <LinearProgress
          variant="determinate"
          value={progress.overallProgress}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'action.hover',
            mb: 1,
            '& .MuiLinearProgress-bar': {
              bgcolor: jobColor,
              borderRadius: 3,
            },
          }}
        />

        {/* Items Progress */}
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            Step {progress.currentStepIndex + 1} of {progress.totalSteps}
          </Typography>
          {progress.itemsTotal > 0 && (
            <Typography variant="caption" color="text.secondary">
              {progress.itemsProcessed.toLocaleString()} / {progress.itemsTotal.toLocaleString()}{' '}
              items
            </Typography>
          )}
        </Stack>

        {progress.currentItem && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              display: 'block',
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {progress.currentItem}
          </Typography>
        )}
      </Box>

      {/* Logs Toggle */}
      <Button
        size="small"
        onClick={onToggleLogs}
        endIcon={logsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ color: 'text.secondary' }}
      >
        {logsExpanded ? 'Hide' : 'Show'} Logs ({progress.logs.length})
      </Button>

      {/* Logs Panel */}
      <Collapse in={logsExpanded}>
        <JobLogs logs={progress.logs} containerRef={logsContainerRef} />
      </Collapse>
    </Box>
  )
}



