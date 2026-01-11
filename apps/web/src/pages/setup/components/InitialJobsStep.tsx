import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as RunningIcon,
  Terminal as TerminalIcon,
  Close as CloseIcon,
  Sync as SyncIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  CloudSync as CloudSyncIcon,
  Warning as WarningIcon,
  SkipNext as SkipIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import type { SetupWizardContext, JobProgress, UserLibraryResult } from '../types'

interface InitialJobsStepProps {
  wizard: SetupWizardContext
}

// Amusing messages to cycle through while waiting (with movie references!)
const WAITING_MESSAGES = [
  "Now might be a good time to grab some popcorn and put on a movie! 🍿",
  "Still here? The AI is working hard, we promise! 🤖",
  "Seriously? You're still watching the progress bar? 👀",
  "Pro tip: This is a great time to refill your coffee ☕",
  "The robots are analyzing your exquisite taste in media... 🎬",
  "Our AI is binge-watching your library metadata right now 📺",
  "You know what pairs well with waiting? Snacks. Go get some snacks. 🍕",
  "The AI is judging your movie collection... in the nicest way possible 🎭",
  "The embeddings are embedding. The syncs are syncing. All is well. ✨",
  // Movie quotes adapted for the context
  "\"The metadata really ties the whole collection together, man.\" – The Dude 🎳",
  "\"After all, tomorrow is another sync job.\" – Scarlett O'Hara 👗",
  "\"Here's looking at you, progress bar.\" – Rick Blaine 🥃",
  "\"You can't handle the embeddings!\" – Colonel Jessup ⚖️",
  "\"I'll be back... when the sync is done.\" – The Terminator 🤖",
  "\"Life is like a box of recommendations. You never know what you're gonna get.\" – Forrest Gump 🍫",
  "\"May the embeddings be with you.\" – Obi-Wan Kenobi ⚔️",
  "\"E.T. phone home... to check on the sync progress.\" – E.T. 👽",
  "\"You're gonna need a bigger library.\" – Chief Brody 🦈",
  "\"I see watched movies.\" – Cole Sear 👻",
  "\"To infinity and beyond!\" ...is how long this might take for big libraries. – Buzz Lightyear 🚀",
  "\"Why so serious? It's just a progress bar.\" – The Joker 🃏",
  "\"I'm the king of the metadata!\" – Jack Dawson 🚢",
  "\"Keep your friends close, but your watch history closer.\" – Michael Corleone 🎩",
  "\"There's no place like a fully synced library.\" – Dorothy 🌈",
  "\"Frankly my dear, I don't give a damn... how long this takes.\" – Rhett Butler 💨",
  "\"You had me at 'Start Initialization'.\" – Jerry Maguire 💕",
  "\"I feel the need... the need for speed!\" Same, progress bar. Same. – Maverick ✈️",
  "\"Just keep syncing, just keep syncing...\" – Dory 🐟",
  "\"It's alive! IT'S ALIVE!\" ...the sync job, we mean. – Dr. Frankenstein ⚡",
]

function getJobIcon(jobId: string) {
  if (jobId.includes('sync-movie') || jobId.includes('sync-series')) {
    if (jobId.includes('watch-history')) return <SyncIcon fontSize="small" />
    if (jobId.includes('libraries')) return <CloudSyncIcon fontSize="small" />
    return <SyncIcon fontSize="small" />
  }
  if (jobId.includes('embedding')) return <PsychologyIcon fontSize="small" />
  if (jobId.includes('recommendation')) return <AutoAwesomeIcon fontSize="small" />
  return <SyncIcon fontSize="small" />
}

function JobStatusIcon({ status }: { status: JobProgress['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon color="success" />
    case 'failed':
      return <ErrorIcon color="error" />
    case 'running':
      return <CircularProgress size={24} />
    default:
      return <PendingIcon color="disabled" />
  }
}

function UserStatusIcon({ status }: { status: UserLibraryResult['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircleIcon fontSize="small" color="success" />
    case 'skipped':
      return <SkipIcon fontSize="small" color="warning" />
    case 'failed':
      return <ErrorIcon fontSize="small" color="error" />
    default:
      return <PendingIcon fontSize="small" color="disabled" />
  }
}

function UserLibraryResultItem({ user }: { user: UserLibraryResult }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderLeft: '3px solid',
        borderColor:
          user.status === 'success'
            ? 'success.main'
            : user.status === 'skipped'
              ? 'warning.main'
              : 'error.main',
        backgroundColor: 'action.hover',
        borderRadius: '0 4px 4px 0',
      }}
    >
      <UserStatusIcon status={user.status} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={500}>
            {user.displayName}
          </Typography>
          {user.status === 'success' && user.recommendationCount !== undefined && (
            <Chip
              label={`${user.recommendationCount} recommendations`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
          {user.libraryCreated && (
            <Chip
              label="New library"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        {user.libraryName && user.status === 'success' && (
          <Typography variant="caption" color="text.secondary">
            {user.libraryName}
          </Typography>
        )}
        {user.status === 'skipped' && user.error && (
          <Typography variant="caption" color="warning.main">
            {user.error}
          </Typography>
        )}
        {user.status === 'failed' && user.error && (
          <Typography variant="caption" color="error.main">
            {user.error}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function LibraryResultsSummary({ jobs, type }: { jobs: JobProgress[]; type: 'movies' | 'series' }) {
  const jobId = type === 'movies' ? 'sync-movie-libraries' : 'sync-series-libraries'
  const job = jobs.find((j) => j.id === jobId)
  
  if (!job || job.status !== 'completed' || !job.result?.users?.length) {
    return null
  }

  const users = job.result.users
  const successCount = users.filter((u) => u.status === 'success').length
  const skippedCount = users.filter((u) => u.status === 'skipped').length
  const failedCount = users.filter((u) => u.status === 'failed').length

  const hasIssues = skippedCount > 0 || failedCount > 0

  return (
    <Accordion 
      defaultExpanded={hasIssues}
      sx={{ 
        mt: 1.5, 
        '&:before': { display: 'none' },
        border: '1px solid',
        borderColor: failedCount > 0 ? 'error.main' : skippedCount > 0 ? 'warning.main' : 'success.main',
        borderRadius: '8px !important',
        overflow: 'hidden',
      }}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />}
        sx={{ 
          backgroundColor: failedCount > 0 ? 'error.dark' : skippedCount > 0 ? 'warning.dark' : 'success.dark',
          '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
        }}
      >
        <CloudSyncIcon fontSize="small" />
        <Typography variant="body2" fontWeight={600}>
          {type === 'movies' ? 'Movie' : 'TV Series'} Libraries Created
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {successCount > 0 && (
            <Chip 
              icon={<CheckCircleIcon />} 
              label={`${successCount} created`} 
              size="small" 
              color="success" 
              sx={{ height: 24 }}
            />
          )}
          {skippedCount > 0 && (
            <Chip 
              icon={<WarningIcon />} 
              label={`${skippedCount} skipped`} 
              size="small" 
              color="warning" 
              sx={{ height: 24 }}
            />
          )}
          {failedCount > 0 && (
            <Chip 
              icon={<ErrorIcon />} 
              label={`${failedCount} failed`} 
              size="small" 
              color="error" 
              sx={{ height: 24 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {users.map((user) => (
            <UserLibraryResultItem key={user.userId} user={user} />
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

function JobListItem({ job, isActive }: { job: JobProgress; isActive: boolean }) {
  // Format the count display
  const countDisplay =
    job.itemsTotal && job.itemsTotal > 0
      ? `${job.itemsProcessed ?? 0} / ${job.itemsTotal}`
      : null

  return (
    <ListItem
      sx={{
        py: 1.5,
        px: 2,
        backgroundColor: isActive ? 'action.selected' : 'transparent',
        borderRadius: 1,
        mb: 0.5,
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : job.status === 'completed' ? 'success.main' : job.status === 'failed' ? 'error.main' : 'divider',
        borderLeftWidth: 3,
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <JobStatusIcon status={job.status} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getJobIcon(job.id)}
            <Typography variant="body2" fontWeight={isActive ? 600 : 400}>
              {job.name}
            </Typography>
            {countDisplay && job.status === 'running' && (
              <Chip
                label={countDisplay}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: 'auto', fontFamily: 'monospace', fontWeight: 600 }}
              />
            )}
            {job.status === 'completed' && job.itemsTotal && job.itemsTotal > 0 && (
              <Chip
                label={`${job.itemsTotal} items`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ ml: 'auto', fontFamily: 'monospace' }}
              />
            )}
          </Box>
        }
        secondary={
          <Box>
            {job.status === 'running' ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {job.currentStep || job.message || job.description}
                </Typography>
                {job.currentItem && (
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', mt: 0.5 }}
                  >
                    → {job.currentItem.length > 60 ? `${job.currentItem.slice(0, 60)}...` : job.currentItem}
                  </Typography>
                )}
              </Box>
            ) : job.status === 'pending' ? (
              <Typography variant="caption" color="text.secondary">
                {job.description}
              </Typography>
            ) : null}
            {job.status === 'running' && job.progress !== undefined && (
              <LinearProgress
                variant="determinate"
                value={job.progress}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            )}
            {job.status === 'failed' && job.error && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                Error: {job.error}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  )
}

export function InitialJobsStep({ wizard }: InitialJobsStepProps) {
  const { error, runningJobs, jobLogs, jobsProgress, currentJobIndex, runInitialJobs, goToStep } = wizard
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [waitingMessageIndex, setWaitingMessageIndex] = useState(0)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const completedCount = jobsProgress.filter((j) => j.status === 'completed').length
  const totalCount = jobsProgress.length
  const hasStarted = jobsProgress.length > 0
  const allCompleted = hasStarted && completedCount === totalCount
  const hasFailed = jobsProgress.some((j) => j.status === 'failed')

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [jobLogs])

  // Cycle through amusing waiting messages every 10 seconds while jobs are running
  useEffect(() => {
    if (!runningJobs || allCompleted) return

    const interval = setInterval(() => {
      setWaitingMessageIndex((prev) => {
        // Pick a random different message
        let next = Math.floor(Math.random() * WAITING_MESSAGES.length)
        while (next === prev && WAITING_MESSAGES.length > 1) {
          next = Math.floor(Math.random() * WAITING_MESSAGES.length)
        }
        return next
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [runningJobs, allCompleted])

  // Calculate totals
  const totalItemsProcessed = jobsProgress.reduce((sum, j) => sum + (j.itemsProcessed || 0), 0)
  const totalItems = jobsProgress.reduce((sum, j) => sum + (j.itemsTotal || 0), 0)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Initialize Your Library
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture will now sync your media library, analyze content with AI, and generate personalized recommendations.
        This process runs through several steps and may take a few minutes depending on your library size.
      </Typography>

      {!hasStarted && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              What happens during initialization:
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2, '& li': { mb: 0.5 } }}>
              <li>
                <Typography variant="body2">
                  <strong>Sync Media</strong> — Import movie and TV series metadata from your media server
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Sync Watch History</strong> — Import viewing history to understand preferences
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Generate Embeddings</strong> — Create AI vectors to understand content themes (uses OpenAI)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Generate Recommendations</strong> — Create personalized picks for each user
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Sync Libraries</strong> — Push recommendation libraries to your media server
                </Typography>
              </li>
            </Box>
          </Alert>
        </>
      )}

      {/* Show timing warning before and during sync (hide after completion) */}
      {!allCompleted && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={false}>
          <Typography variant="body2">
            <strong>Heads up!</strong> This can take anywhere from a few minutes to 30+ minutes depending on the size
            of your media libraries. Large collections with thousands of movies and episodes will take longer.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            {WAITING_MESSAGES[waitingMessageIndex]}
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Progress Summary */}
      {hasStarted && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Progress: {completedCount} of {totalCount} jobs
              </Typography>
              {totalItems > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {totalItemsProcessed.toLocaleString()} / {totalItems.toLocaleString()} items processed
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {allCompleted && <Chip label="All Complete" color="success" size="small" icon={<CheckCircleIcon />} />}
              {hasFailed && <Chip label="Failed" color="error" size="small" icon={<ErrorIcon />} />}
              {runningJobs && !hasFailed && (
                <Chip label="Running" color="primary" size="small" icon={<RunningIcon />} />
              )}
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(completedCount / totalCount) * 100}
            sx={{ height: 8, borderRadius: 4 }}
            color={hasFailed ? 'error' : allCompleted ? 'success' : 'primary'}
          />
        </Box>
      )}

      {/* Job List */}
      {hasStarted && (
        <Paper variant="outlined" sx={{ mb: 3, maxHeight: 400, overflow: 'auto' }}>
          <List disablePadding sx={{ p: 1 }}>
            {jobsProgress.map((job, index) => (
              <JobListItem key={job.id} job={job} isActive={index === currentJobIndex} />
            ))}
          </List>
        </Paper>
      )}

      {/* Per-User Library Creation Results */}
      {hasStarted && (allCompleted || hasFailed) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Library Creation Results
          </Typography>
          <LibraryResultsSummary jobs={jobsProgress} type="movies" />
          <LibraryResultsSummary jobs={jobsProgress} type="series" />
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => goToStep('openai')} disabled={runningJobs}>
          Back
        </Button>

        {!hasStarted && (
          <Button
            variant="contained"
            onClick={runInitialJobs}
            disabled={runningJobs}
            startIcon={runningJobs ? <CircularProgress size={20} color="inherit" /> : <RunningIcon />}
            size="large"
          >
            Start Initialization
          </Button>
        )}

        {hasStarted && !allCompleted && !hasFailed && (
          <Button variant="contained" disabled startIcon={<CircularProgress size={20} color="inherit" />}>
            Running... ({completedCount}/{totalCount})
          </Button>
        )}

        {hasFailed && (
          <Button
            variant="contained"
            color="warning"
            onClick={runInitialJobs}
            disabled={runningJobs}
            startIcon={<RunningIcon />}
          >
            Retry
          </Button>
        )}

        {hasStarted && (
          <Button
            variant="outlined"
            onClick={() => setLogModalOpen(true)}
            startIcon={<TerminalIcon />}
            color={runningJobs ? 'primary' : 'inherit'}
          >
            View Logs {runningJobs && '(Live)'} ({jobLogs.length})
          </Button>
        )}

        {allCompleted && (
          <Button variant="contained" color="success" onClick={() => goToStep('complete')}>
            Continue to Finish
          </Button>
        )}
      </Box>

      {/* Log Modal */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerminalIcon />
            <Typography variant="h6">Live Job Logs</Typography>
            <Chip label={`${jobLogs.length} entries`} size="small" variant="outlined" />
          </Box>
          <IconButton onClick={() => setLogModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Paper
            ref={logContainerRef}
            sx={{
              p: 2,
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: '0.75rem',
              lineHeight: 1.8,
              height: 450,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              '&::-webkit-scrollbar': { width: 8 },
              '&::-webkit-scrollbar-track': { background: '#161b22' },
              '&::-webkit-scrollbar-thumb': { background: '#30363d', borderRadius: 4 },
            }}
          >
            {jobLogs.length > 0 ? (
              jobLogs.map((log, i) => {
                // Determine color based on content
                let color = '#c9d1d9' // default gray
                if (log.includes('✗') || log.includes('ERROR') || log.includes('FAILED')) {
                  color = '#f85149' // red
                } else if (log.includes('✓') || log.includes('Completed') || log.includes('successfully')) {
                  color = '#3fb950' // green
                } else if (log.includes('▶') || log.includes('Starting')) {
                  color = '#58a6ff' // blue
                } else if (log.includes('⚠')) {
                  color = '#d29922' // yellow/orange
                } else if (log.includes('•')) {
                  color = '#8b949e' // muted gray for info
                } else if (log.includes('→')) {
                  color = '#a5d6ff' // light blue for current item
                }

                return (
                  <Box
                    key={i}
                    sx={{
                      color,
                      py: 0.25,
                      borderBottom: '1px solid #21262d',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    {log}
                  </Box>
                )
              })
            ) : (
              <Typography variant="body2" sx={{ color: '#484f58', fontStyle: 'italic' }}>
                No logs yet. Start initialization to see live output.
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Logs auto-scroll to bottom • {runningJobs ? 'Streaming live...' : 'Complete'}
          </Typography>
          <Button onClick={() => setLogModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
