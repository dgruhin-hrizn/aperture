import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  Popper,
  Paper,
  Fade,
  ClickAwayListener,
  Chip,
  Divider,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { useAuth } from '@/hooks/useAuth'

interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: string
  currentStepIndex: number
  totalSteps: number
  stepProgress: number
  overallProgress: number
  itemsProcessed: number
  itemsTotal: number
  currentItem?: string
  error?: string
}

// Map job names to friendly display names
const JOB_DISPLAY_NAMES: Record<string, string> = {
  'sync-movies': 'Syncing Movies',
  'generate-embeddings': 'Generating Embeddings',
  'sync-watch-history': 'Syncing Watch History',
  'full-sync-watch-history': 'Full Watch History Sync',
  'generate-recommendations': 'Generating Recommendations',
  'rebuild-recommendations': 'Rebuilding Recommendations',
  'sync-movie-libraries': 'Building Aperture Movie Libraries',
  'sync-series': 'Syncing Series',
  'generate-series-embeddings': 'Generating Series Embeddings',
  'sync-series-watch-history': 'Syncing Series History',
  'full-sync-series-watch-history': 'Full Series History Sync',
  'generate-series-recommendations': 'Generating Series Recommendations',
  'sync-series-libraries': 'Building Aperture Series Libraries',
  'refresh-top-picks': 'Refreshing Top Picks',
}

function getJobDisplayName(jobName: string): string {
  return JOB_DISPLAY_NAMES[jobName] || jobName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const seconds = Math.floor((now - start) / 1000)
  
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export function RunningJobsWidget() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [jobs, setJobs] = useState<JobProgress[]>([])
  const { user } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const open = Boolean(anchorEl)

  const fetchJobs = async () => {
    if (!user?.isAdmin) return
    
    try {
      const response = await fetch('/api/jobs/active', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch active jobs:', error)
    }
  }

  useEffect(() => {
    if (!user?.isAdmin) return

    fetchJobs()
    intervalRef.current = setInterval(fetchJobs, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user?.isAdmin])

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  if (!user?.isAdmin) return null

  const runningJobs = jobs.filter(j => j.status === 'running')
  const recentJobs = jobs.filter(j => j.status !== 'running').slice(0, 5)
  const hasRunningJobs = runningJobs.length > 0

  // Calculate combined progress
  const combinedProgress = runningJobs.length > 0
    ? Math.round(runningJobs.reduce((sum, job) => sum + job.overallProgress, 0) / runningJobs.length)
    : 0

  // Get the primary job name to display
  const primaryJobName = runningJobs.length === 1
    ? getJobDisplayName(runningJobs[0].jobName)
    : runningJobs.length > 1
      ? `${runningJobs.length} jobs running`
      : 'No active jobs'

  if (!hasRunningJobs) return null

  return (
    <>
      {/* Compact progress widget in app bar */}
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 0.75,
          mr: 1,
          borderRadius: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
          minWidth: 200,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 500,
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              mb: 0.5,
            }}
          >
            {primaryJobName}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={combinedProgress}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '200% 0' },
                  '100%': { backgroundPosition: '-200% 0' },
                },
              },
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '0.8rem',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {combinedProgress}%
        </Typography>
      </Box>

      {/* Detailed popper on click */}
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-end"
        transition
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              sx={{
                mt: 1,
                minWidth: 340,
                maxWidth: 400,
                maxHeight: 400,
                overflow: 'auto',
                borderRadius: 2,
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box>
                  {/* Header */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      Running Jobs
                    </Typography>
                  </Box>

                  {/* Running Jobs */}
                  <Box sx={{ p: 2 }}>
                    {runningJobs.map((job) => (
                      <Box
                        key={job.jobId}
                        sx={{
                          mb: 2,
                          '&:last-child': { mb: 0 },
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="body2" fontWeight={500}>
                            {getJobDisplayName(job.jobName)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDuration(job.startedAt)}
                          </Typography>
                        </Box>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {job.currentStep}
                          {job.itemsTotal > 0 && ` • ${job.itemsProcessed}/${job.itemsTotal}`}
                        </Typography>

                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={job.overallProgress}
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s ease-in-out infinite',
                                '@keyframes shimmer': {
                                  '0%': { backgroundPosition: '200% 0' },
                                  '100%': { backgroundPosition: '-200% 0' },
                                },
                              },
                            }}
                          />
                          <Typography variant="caption" fontWeight={600} sx={{ minWidth: 36, textAlign: 'right' }}>
                            {Math.round(job.overallProgress)}%
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  {/* Recent Jobs */}
                  {recentJobs.length > 0 && (
                    <>
                      <Divider />
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          RECENT
                        </Typography>
                        {recentJobs.map((job) => (
                          <Box
                            key={job.jobId}
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ py: 0.75 }}
                          >
                            <Box display="flex" alignItems="center" gap={1}>
                              {job.status === 'completed' ? (
                                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                              )}
                              <Typography variant="caption">
                                {getJobDisplayName(job.jobName)}
                              </Typography>
                            </Box>
                            <Chip
                              label={job.status}
                              size="small"
                              color={job.status === 'completed' ? 'success' : 'error'}
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default RunningJobsWidget
