import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Skeleton,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'
import MovieIcon from '@mui/icons-material/Movie'
import PsychologyIcon from '@mui/icons-material/Psychology'
import HistoryIcon from '@mui/icons-material/History'
import RecommendIcon from '@mui/icons-material/Recommend'
import FolderIcon from '@mui/icons-material/Folder'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, unknown>
}

interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
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
  logs: LogEntry[]
  error?: string
  result?: Record<string, unknown>
}

interface Job {
  name: string
  description: string
  cron: string | null
  status: 'idle' | 'running' | 'failed'
  currentJobId?: string
  progress?: {
    overallProgress: number
    currentStep: string
    itemsProcessed: number
    itemsTotal: number
  }
}

const JOB_ICONS: Record<string, React.ReactNode> = {
  'sync-movies': <MovieIcon />,
  'generate-embeddings': <PsychologyIcon />,
  'sync-watch-history': <HistoryIcon />,
  'generate-recommendations': <RecommendIcon />,
  'update-permissions': <FolderIcon />,
}

const JOB_COLORS: Record<string, string> = {
  'sync-movies': '#2196f3',
  'generate-embeddings': '#9c27b0',
  'sync-watch-history': '#ff9800',
  'generate-recommendations': '#4caf50',
  'update-permissions': '#607d8b',
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)
  const [expandedLogs, setExpandedLogs] = useState(false)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs)
        setError(null)
        
        // Check if any job is running
        const runningJob = data.jobs.find((j: Job) => j.status === 'running')
        if (runningJob?.currentJobId && runningJob.currentJobId !== activeJobId) {
          connectToJobStream(runningJob.currentJobId)
        }
      } else {
        setError('Failed to load jobs')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }, [activeJobId])

  const connectToJobStream = useCallback((jobId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setActiveJobId(jobId)
    setExpandedLogs(true)

    const eventSource = new EventSource(`/api/jobs/progress/stream/${jobId}`, {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as JobProgress
        setJobProgress(progress)

        // Auto-scroll logs within container only (not the whole page)
        setTimeout(() => {
          if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
          }
        }, 100)

        // If job completed, refresh jobs list
        if (progress.status === 'completed' || progress.status === 'failed') {
          setTimeout(() => {
            fetchJobs()
          }, 1000)
        }
      } catch (err) {
        console.error('Failed to parse progress:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      setActiveJobId(null)
    }

    eventSourceRef.current = eventSource
  }, [fetchJobs])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 10000) // Refresh every 10s
    return () => {
      clearInterval(interval)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [fetchJobs])

  const handleRunJob = async (jobName: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobName}/run`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        // Connect to job progress stream
        connectToJobStream(data.jobId)
        // Refresh jobs list
        await fetchJobs()
      }
    } catch (err) {
      console.error('Failed to run job:', err)
    }
  }

  const getStatusChip = (job: Job) => {
    const color = JOB_COLORS[job.name] || '#666'
    
    switch (job.status) {
      case 'running':
        return (
          <Chip
            icon={<HourglassEmptyIcon />}
            label="Running"
            size="small"
            sx={{ 
              bgcolor: `${color}22`,
              color: color,
              '& .MuiChip-icon': { color: color }
            }}
          />
        )
      case 'failed':
        return (
          <Chip
            icon={<ErrorIcon />}
            label="Failed"
            size="small"
            color="error"
          />
        )
      default:
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Ready"
            size="small"
            variant="outlined"
            sx={{ borderColor: 'divider' }}
          />
        )
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />
      case 'warn':
        return <WarningIcon fontSize="small" color="warning" />
      default:
        return <InfoIcon fontSize="small" color="info" />
    }
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          Jobs
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Jobs
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Background jobs for syncing, AI processing, and recommendations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Active Job Progress Panel */}
      {jobProgress && (jobProgress.status === 'running' || jobProgress.status === 'completed' || jobProgress.status === 'failed') && (
        <Paper
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${JOB_COLORS[jobProgress.jobName] || '#666'}15, transparent)`,
            border: `1px solid ${JOB_COLORS[jobProgress.jobName] || '#666'}33`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 1, 
              bgcolor: `${JOB_COLORS[jobProgress.jobName]}22`,
              color: JOB_COLORS[jobProgress.jobName]
            }}>
              {JOB_ICONS[jobProgress.jobName]}
            </Box>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={600}>
                {jobProgress.jobName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {jobProgress.currentStep}
                {jobProgress.currentItem && ` • ${jobProgress.currentItem}`}
              </Typography>
            </Box>
            <Chip
              label={jobProgress.status === 'completed' ? '✅ Complete' : 
                     jobProgress.status === 'failed' ? '❌ Failed' : 
                     `${jobProgress.overallProgress}%`}
              color={jobProgress.status === 'completed' ? 'success' : 
                     jobProgress.status === 'failed' ? 'error' : 'primary'}
              size="small"
            />
          </Stack>

          {/* Progress Bar */}
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Step {jobProgress.currentStepIndex + 1} of {jobProgress.totalSteps}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {jobProgress.itemsProcessed} / {jobProgress.itemsTotal} items
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={jobProgress.overallProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: JOB_COLORS[jobProgress.jobName],
                  borderRadius: 4,
                }
              }}
            />
          </Box>

          {/* Logs Section */}
          <Box>
            <Button
              size="small"
              onClick={() => setExpandedLogs(!expandedLogs)}
              endIcon={expandedLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ mb: 1 }}
            >
              {expandedLogs ? 'Hide' : 'Show'} Logs ({jobProgress.logs.length})
            </Button>
            
            <Collapse in={expandedLogs}>
              <Paper
                ref={logsContainerRef}
                sx={{
                  maxHeight: 300,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                  p: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              >
                <List dense disablePadding>
                  {jobProgress.logs.slice(-50).map((log, i) => (
                    <ListItem
                      key={i}
                      disablePadding
                      sx={{
                        py: 0.25,
                        px: 1,
                        bgcolor: log.level === 'error' ? 'error.dark' : 
                                 log.level === 'warn' ? 'warning.dark' : 'transparent',
                        borderRadius: 0.5,
                        mb: 0.25,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            {getLogIcon(log.level)}
                            <Typography
                              variant="caption"
                              fontFamily="monospace"
                              color="text.secondary"
                            >
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </Typography>
                            <Typography
                              variant="body2"
                              fontFamily="monospace"
                              sx={{ wordBreak: 'break-word' }}
                            >
                              {log.message}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Collapse>
          </Box>

          {/* Result Summary */}
          {jobProgress.status === 'completed' && jobProgress.result && (
            <Box mt={2} p={2} bgcolor="success.dark" borderRadius={1}>
              <Typography variant="body2" fontWeight={600} mb={1}>
                ✅ Job Results
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                {Object.entries(jobProgress.result).map(([key, value]) => (
                  <Box key={key}>
                    <Typography variant="caption" color="text.secondary">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Error Message */}
          {jobProgress.status === 'failed' && jobProgress.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {jobProgress.error}
            </Alert>
          )}
        </Paper>
      )}

      {/* Job Cards */}
      <Grid container spacing={3}>
        {jobs.map((job) => (
          <Grid item xs={12} md={6} key={job.name}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 2,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                },
                borderLeft: `4px solid ${JOB_COLORS[job.name] || '#666'}`,
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="flex-start" spacing={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: `${JOB_COLORS[job.name]}15`,
                      color: JOB_COLORS[job.name],
                    }}
                  >
                    {JOB_ICONS[job.name]}
                  </Box>
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {job.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </Typography>
                      {getStatusChip(job)}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      {job.description}
                    </Typography>
                    {job.cron && (
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        Schedule: {job.cron}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                {/* Mini progress for running jobs */}
                {job.status === 'running' && job.progress && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      {job.progress.currentStep}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={job.progress.overallProgress}
                      sx={{
                        mt: 0.5,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: JOB_COLORS[job.name],
                        }
                      }}
                    />
                  </Box>
                )}
              </CardContent>
              <Divider />
              <CardActions sx={{ px: 2, py: 1.5 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleRunJob(job.name)}
                  disabled={job.status === 'running'}
                  sx={{
                    bgcolor: JOB_COLORS[job.name],
                    '&:hover': {
                      bgcolor: JOB_COLORS[job.name],
                      filter: 'brightness(1.1)',
                    }
                  }}
                >
                  {job.status === 'running' ? 'Running...' : 'Run Now'}
                </Button>
                {job.currentJobId && (
                  <Button
                    size="small"
                    onClick={() => connectToJobStream(job.currentJobId!)}
                  >
                    View Progress
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
