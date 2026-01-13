import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CancelIcon from '@mui/icons-material/Cancel'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { JOB_ICONS, JOB_COLORS, formatJobName } from '@/pages/jobs/constants'

interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: string
  itemsProcessed: number
  itemsTotal: number
  overallProgress: number
  logs: Array<{ timestamp: string; level: string; message: string }>
  error?: string
}

interface JobInfo {
  name: string
  description: string
  status: 'idle' | 'running'
  currentJobId?: string
  lastRun?: {
    status: 'completed' | 'failed' | 'cancelled'
    startedAt: string
    durationMs: number
    itemsProcessed: number
    itemsTotal: number
    errorMessage?: string
  }
}

interface InlineJobPanelProps {
  /** Job name (e.g., 'sync-movies', 'refresh-top-picks') */
  jobName: string
  /** Optional custom title (defaults to formatted job name) */
  title?: string
  /** Optional description override */
  description?: string
  /** Compact mode - shows minimal UI */
  compact?: boolean
  /** Hide the icon */
  hideIcon?: boolean
  /** Callback when job completes successfully */
  onComplete?: () => void
  /** Callback when job fails */
  onError?: (error: string) => void
}

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

export function InlineJobPanel({
  jobName,
  title,
  description,
  compact = false,
  hideIcon = false,
  onComplete,
  onError,
}: InlineJobPanelProps) {
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const jobColor = JOB_COLORS[jobName] || '#666'

  const fetchJobInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const job = data.jobs.find((j: JobInfo) => j.name === jobName)
        if (job) {
          setJobInfo(job)
          if (job.status === 'running' && job.currentJobId) {
            setRunning(true)
            connectToStream(job.currentJobId)
          }
        }
      }
    } catch {
      // Silently fail - not critical
    } finally {
      setLoading(false)
    }
  }, [jobName])

  const connectToStream = useCallback((jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(`/api/jobs/progress/stream/${jobId}`, {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      try {
        const progressData = JSON.parse(event.data) as JobProgress
        setProgress(progressData)

        // Auto-scroll logs
        setTimeout(() => {
          if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
          }
        }, 100)

        // Handle completion
        if (progressData.status === 'completed') {
          setTimeout(() => {
            setRunning(false)
            setProgress(null)
            fetchJobInfo()
            onComplete?.()
          }, 1500)
        } else if (progressData.status === 'failed') {
          setTimeout(() => {
            setRunning(false)
            setError(progressData.error || 'Job failed')
            fetchJobInfo()
            onError?.(progressData.error || 'Job failed')
          }, 1500)
        } else if (progressData.status === 'cancelled') {
          setTimeout(() => {
            setRunning(false)
            setProgress(null)
            fetchJobInfo()
          }, 1500)
        }
      } catch (err) {
        console.error('Failed to parse progress:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
    }

    eventSourceRef.current = eventSource
  }, [fetchJobInfo, onComplete, onError])

  useEffect(() => {
    fetchJobInfo()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [fetchJobInfo])

  const handleRun = async () => {
    setError(null)
    setRunning(true)
    setShowLogs(true)

    try {
      const response = await fetch(`/api/jobs/${jobName}/run`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        connectToStream(data.jobId)
      } else {
        const errData = await response.json()
        setError(errData.error || 'Failed to start job')
        setRunning(false)
        onError?.(errData.error || 'Failed to start job')
      }
    } catch {
      setError('Failed to connect to server')
      setRunning(false)
      onError?.('Failed to connect to server')
    }
  }

  const handleCancel = async () => {
    if (!progress?.jobId) return
    setCancelling(true)

    try {
      await fetch(`/api/jobs/${jobName}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: progress.jobId }),
      })
    } catch {
      // Ignore cancel errors
    } finally {
      setCancelling(false)
    }
  }

  const getLastRunInfo = () => {
    if (!jobInfo?.lastRun) return null
    const { status, startedAt, durationMs, itemsProcessed, itemsTotal, errorMessage } = jobInfo.lastRun
    return {
      status,
      time: formatRelativeTime(startedAt),
      duration: formatDuration(durationMs),
      items: itemsTotal > 0 ? `${itemsProcessed}/${itemsTotal}` : itemsProcessed > 0 ? `${itemsProcessed}` : null,
      error: errorMessage,
      icon: status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> :
            status === 'failed' ? <ErrorIcon sx={{ fontSize: 14 }} /> :
            <CancelIcon sx={{ fontSize: 14 }} />,
      color: status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning',
    }
  }

  const lastRunInfo = getLastRunInfo()
  const displayTitle = title || formatJobName(jobName)
  const displayDescription = description || jobInfo?.description

  if (loading) {
    return (
      <Box sx={{ py: 1 }}>
        <LinearProgress sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  // Compact mode - just a button with status
  if (compact) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        {running ? (
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={cancelling ? null : <StopIcon />}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Stopping...' : 'Stop'}
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
            sx={{
              bgcolor: jobColor,
              '&:hover': { bgcolor: jobColor, filter: 'brightness(1.15)' },
            }}
          >
            Run
          </Button>
        )}
        {running && progress && (
          <Typography variant="caption" color="text.secondary">
            {progress.currentStep || 'Starting...'}
          </Typography>
        )}
        {!running && lastRunInfo && (
          <Chip
            size="small"
            icon={lastRunInfo.icon}
            label={lastRunInfo.time}
            color={lastRunInfo.color as 'success' | 'error' | 'warning'}
            variant="outlined"
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        )}
      </Stack>
    )
  }

  // Full mode
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: running ? `${jobColor}55` : 'divider',
        transition: 'all 0.3s ease',
        ...(running && { boxShadow: `0 0 12px ${jobColor}15` }),
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          {!hideIcon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                bgcolor: `${jobColor}15`,
                color: jobColor,
                display: 'flex',
              }}
            >
              {JOB_ICONS[jobName]}
            </Box>
          )}
          <Box flex={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                {displayTitle}
              </Typography>
              {running && (
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
            {displayDescription && (
              <Typography variant="caption" color="text.secondary">
                {displayDescription}
              </Typography>
            )}
          </Box>
          
          {/* Action Button */}
          {running ? (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={cancelling ? null : <StopIcon />}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Stopping...' : 'Stop'}
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={handleRun}
              sx={{
                bgcolor: jobColor,
                '&:hover': { bgcolor: jobColor, filter: 'brightness(1.15)' },
              }}
            >
              Run
            </Button>
          )}
        </Stack>

        {/* Last Run Info (when not running) */}
        {!running && lastRunInfo && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={lastRunInfo.error || `Duration: ${lastRunInfo.duration}${lastRunInfo.items ? ` • Items: ${lastRunInfo.items}` : ''}`}>
              <Chip
                size="small"
                icon={lastRunInfo.icon}
                label={`Last run: ${lastRunInfo.time}`}
                color={lastRunInfo.color as 'success' | 'error' | 'warning'}
                variant="outlined"
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            </Tooltip>
          </Stack>
        )}

        {/* Error */}
        {error && !running && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}

        {/* Progress */}
        <Collapse in={running && !!progress}>
          {progress && (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {progress.currentStep || 'Processing...'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {progress.itemsTotal > 0
                    ? `${progress.itemsProcessed}/${progress.itemsTotal}`
                    : progress.itemsProcessed > 0
                    ? `${progress.itemsProcessed} processed`
                    : ''}
                </Typography>
              </Stack>
              <LinearProgress
                variant={progress.overallProgress > 0 ? 'determinate' : 'indeterminate'}
                value={progress.overallProgress}
                sx={{
                  height: 6,
                  borderRadius: 1,
                  bgcolor: `${jobColor}20`,
                  '& .MuiLinearProgress-bar': { bgcolor: jobColor },
                }}
              />

              {/* Logs toggle */}
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  onClick={() => setShowLogs(!showLogs)}
                  endIcon={showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ textTransform: 'none', color: 'text.secondary' }}
                >
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </Button>
              </Box>

              {/* Logs */}
              <Collapse in={showLogs}>
                <Paper
                  ref={logsContainerRef}
                  variant="outlined"
                  sx={{
                    mt: 1,
                    p: 1,
                    maxHeight: 150,
                    overflow: 'auto',
                    bgcolor: '#0d1117',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  }}
                >
                  {progress.logs.map((log, i) => (
                    <Box
                      key={i}
                      sx={{
                        color: log.level === 'error' ? '#f85149' : log.level === 'warn' ? '#d29922' : '#8b949e',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {log.message}
                    </Box>
                  ))}
                </Paper>
              </Collapse>
            </Box>
          )}
        </Collapse>
      </Stack>
    </Paper>
  )
}

