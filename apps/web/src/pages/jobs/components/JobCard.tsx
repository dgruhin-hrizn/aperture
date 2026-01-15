import React from 'react'
import { Box, Button, Collapse, IconButton, Stack, Tooltip, Typography, Chip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SettingsIcon from '@mui/icons-material/Settings'
import HistoryIcon from '@mui/icons-material/History'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CancelIcon from '@mui/icons-material/Cancel'
import { JOB_ICONS, JOB_COLORS, formatJobName } from '../constants'
import { JobProgressSection } from './JobProgressSection'
import { JobResult } from './JobResult'
import type { Job, JobProgress } from '../types'

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 7) {
    return date.toLocaleDateString()
  } else if (diffDay > 0) {
    return `${diffDay}d ago`
  } else if (diffHour > 0) {
    return `${diffHour}h ago`
  } else if (diffMin > 0) {
    return `${diffMin}m ago`
  } else {
    return 'Just now'
  }
}

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remainingSec = sec % 60
  if (min < 60) return `${min}m ${remainingSec}s`
  const hr = Math.floor(min / 60)
  const remainingMin = min % 60
  return `${hr}h ${remainingMin}m`
}

interface JobCardProps {
  job: Job
  progress: JobProgress | undefined
  logsExpanded: boolean
  isCancelling: boolean
  onRun: () => void
  onCancel: () => void
  onToggleLogs: () => void
  onConfigClick: () => void
  onHistoryClick: () => void
  logsContainerRef: (el: HTMLDivElement | null) => void
  disabled?: boolean
  disabledMessage?: string
}

export function JobCard({
  job,
  progress,
  logsExpanded,
  isCancelling,
  onRun,
  onCancel,
  onToggleLogs,
  onConfigClick,
  onHistoryClick,
  logsContainerRef,
  disabled = false,
  disabledMessage,
}: JobCardProps) {
  const isRunning = job.status === 'running' || progress?.status === 'running'
  const jobColor = JOB_COLORS[job.name] || '#666'
  const showResult =
    !isRunning &&
    progress &&
    (progress.status === 'completed' ||
      progress.status === 'failed' ||
      progress.status === 'cancelled')

  // Last run status icons and colors
  const getLastRunInfo = () => {
    if (!job.lastRun) return null
    const { status, startedAt, durationMs, itemsProcessed, itemsTotal, errorMessage } = job.lastRun
    // Show items count - prefer total format if both available, otherwise just processed count
    let items: string | undefined
    if (itemsTotal > 0) {
      items = `${itemsProcessed}/${itemsTotal}`
    } else if (itemsProcessed > 0) {
      items = `${itemsProcessed} items`
    }
    return {
      status,
      time: formatRelativeTime(startedAt),
      duration: formatDuration(durationMs),
      items,
      error: errorMessage,
      icon: status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> :
            status === 'failed' ? <ErrorIcon sx={{ fontSize: 14 }} /> :
            <CancelIcon sx={{ fontSize: 14 }} />,
      color: status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning',
    }
  }

  const lastRunInfo = getLastRunInfo()

  return (
    <Box
      sx={{
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: disabled ? 'divider' : isRunning ? `${jobColor}55` : 'divider',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        position: 'relative',
        ...(isRunning && !disabled && {
          boxShadow: `0 0 20px ${jobColor}22`,
        }),
        ...(disabled && {
          opacity: 0.6,
        }),
      }}
    >
      {/* Disabled Overlay */}
      {disabled && disabledMessage && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              p: 2,
              textAlign: 'center',
              maxWidth: '90%',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {disabledMessage}
            </Typography>
          </Box>
        </Box>
      )}
      {/* Card Header */}
      <Box
        sx={{
          p: 2.5,
          background: isRunning
            ? `linear-gradient(135deg, ${jobColor}15 0%, transparent 100%)`
            : 'transparent',
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        >
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
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {JOB_ICONS[job.name]}
          </Box>

          {/* Content */}
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
              <Typography variant="subtitle1" fontWeight={600}>
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
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled">
                  {job.schedule?.formatted || 'Not configured'}
                </Typography>
              </Stack>
              {lastRunInfo && !isRunning && (
                <Tooltip title={lastRunInfo.error ? `Error: ${lastRunInfo.error}` : `Duration: ${lastRunInfo.duration}${lastRunInfo.items ? ` • Items: ${lastRunInfo.items}` : ''}`}>
                  <Chip
                    size="small"
                    icon={lastRunInfo.icon}
                    label={`Last run: ${lastRunInfo.time}`}
                    color={lastRunInfo.color as 'success' | 'error' | 'warning'}
                    variant="outlined"
                    onClick={onHistoryClick}
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                      },
                    }}
                  />
                </Tooltip>
              )}
            </Stack>
          </Box>

          {/* Config + Action Buttons */}
          <Stack 
            direction="row" 
            spacing={0.5} 
            alignItems="center"
            justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}
            width={{ xs: '100%', sm: 'auto' }}
          >
            <Tooltip title="View run history">
              <IconButton
                size="small"
                onClick={onHistoryClick}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Configure schedule">
              <IconButton
                size="small"
                onClick={onConfigClick}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
                disabled={disabled}
                sx={{
                  bgcolor: jobColor,
                  minWidth: 90,
                  '&:hover': {
                    bgcolor: jobColor,
                    filter: 'brightness(1.15)',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabledBackground',
                  },
                }}
              >
                Run
              </Button>
            )}
          </Stack>
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

