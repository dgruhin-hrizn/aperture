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
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext, JobProgress, UserLibraryResult } from '../types'

import { WAITING_MESSAGES } from '../constants/waitingMessages'

interface InitialJobsStepProps {
  wizard: SetupWizardContext
}

function getJobIcon(jobId: string) {
  if (jobId.includes('sync-movie') || jobId.includes('sync-series')) {
    if (jobId.includes('watch-history')) return <SyncIcon fontSize="small" />
    if (jobId.includes('libraries')) return <CloudSyncIcon fontSize="small" />
    return <SyncIcon fontSize="small" />
  }
  if (jobId.includes('embedding')) return <PsychologyIcon fontSize="small" />
  if (jobId.includes('recommendation')) return <AutoAwesomeIcon fontSize="small" />
  if (jobId.includes('top-picks')) return <TrendingUpIcon fontSize="small" />
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
    case 'skipped':
      return <SkipIcon color="disabled" />
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
  const { t } = useTranslation()
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
              label={t('setup.complete.recommendationsChip', { count: user.recommendationCount })}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
          {user.libraryCreated && (
            <Chip
              label={t('setup.initialJobsStep.newLibraryChip')}
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
  const { t } = useTranslation()
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
          {type === 'movies' ? t('setup.initialJobsStep.libSummaryMoviesTitle') : t('setup.initialJobsStep.libSummarySeriesTitle')}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {successCount > 0 && (
            <Chip
              icon={<CheckCircleIcon />}
              label={t('setup.initialJobsStep.createdCount', { count: successCount })}
              size="small"
              color="success"
              sx={{ height: 24 }}
            />
          )}
          {skippedCount > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={t('setup.initialJobsStep.skippedCount', { count: skippedCount })}
              size="small"
              color="warning"
              sx={{ height: 24 }}
            />
          )}
          {failedCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={t('setup.initialJobsStep.failedCount', { count: failedCount })}
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

function TopPicksResultsSummary({ jobs }: { jobs: JobProgress[] }) {
  const { t } = useTranslation()
  const job = jobs.find((j) => j.id === 'refresh-top-picks')

  if (!job || (job.status !== 'completed' && job.status !== 'failed')) {
    return null
  }

  const isSuccess = job.status === 'completed'
  const moviesCount = job.result?.moviesCount ?? 0
  const seriesCount = job.result?.seriesCount ?? 0

  return (
    <Accordion
      defaultExpanded={!isSuccess}
      sx={{
        mt: 1.5,
        '&:before': { display: 'none' },
        border: '1px solid',
        borderColor: isSuccess ? 'success.main' : 'error.main',
        borderRadius: '8px !important',
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          backgroundColor: isSuccess ? 'success.dark' : 'error.dark',
          '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
        }}
      >
        <TrendingUpIcon fontSize="small" />
        <Typography variant="body2" fontWeight={600}>
          {t('setup.initialJobsStep.topPicksLibsCreated')}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {isSuccess ? (
            <>
              <Chip
                icon={<CheckCircleIcon />}
                label={t('setup.initialJobsStep.moviesChip', { count: moviesCount })}
                size="small"
                color="success"
                sx={{ height: 24 }}
              />
              <Chip
                icon={<CheckCircleIcon />}
                label={t('setup.initialJobsStep.seriesChip', { count: seriesCount })}
                size="small"
                color="success"
                sx={{ height: 24 }}
              />
            </>
          ) : (
            <Chip icon={<ErrorIcon />} label={t('setup.initialJobsStep.failedChip')} size="small" color="error" sx={{ height: 24 }} />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Box sx={{ p: 1.5 }}>
          {isSuccess ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2">{t('setup.initialJobsStep.topPicksMoviesRow')}</Typography>
                <Chip label={t('setup.initialJobsStep.moviesChip', { count: moviesCount })} size="small" variant="outlined" sx={{ ml: 'auto' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2">{t('setup.initialJobsStep.topPicksSeriesRow')}</Typography>
                <Chip label={t('setup.initialJobsStep.seriesChip', { count: seriesCount })} size="small" variant="outlined" sx={{ ml: 'auto' }} />
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="error">
              {job.error || t('setup.initialJobsStep.topPicksFailedDefault')}
            </Typography>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

interface JobListItemProps {
  job: JobProgress
  isActive: boolean
  canRerun: boolean
  onRerun: () => void
}

function JobListItem({ job, isActive, canRerun, onRerun }: JobListItemProps) {
  const { t } = useTranslation()
  const countDisplay =
    job.itemsTotal && job.itemsTotal > 0 ? `${job.itemsProcessed ?? 0} / ${job.itemsTotal}` : null

  const showRerunButton =
    canRerun &&
    (job.status === 'completed' || job.status === 'failed' || job.status === 'skipped' || job.status === 'pending')

  const getBorderColor = () => {
    if (isActive) return 'primary.main'
    switch (job.status) {
      case 'completed':
        return 'success.main'
      case 'failed':
        return 'error.main'
      case 'skipped':
        return 'grey.500'
      default:
        return 'divider'
    }
  }

  const rerunTitle =
    job.status === 'skipped' || job.status === 'pending'
      ? t('setup.initialJobsStep.rerunRun', { name: job.name })
      : t('setup.initialJobsStep.rerunRerun', { name: job.name })

  return (
    <ListItem
      sx={{
        py: 1.5,
        px: 2,
        backgroundColor: isActive ? 'action.selected' : job.status === 'skipped' ? 'action.disabledBackground' : 'transparent',
        borderRadius: 1,
        mb: 0.5,
        border: '1px solid',
        borderColor: getBorderColor(),
        borderLeftWidth: 3,
        opacity: job.status === 'skipped' ? 0.7 : 1,
      }}
      secondaryAction={
        showRerunButton ? (
          <IconButton
            edge="end"
            size="small"
            onClick={onRerun}
            title={rerunTitle}
            sx={{
              color:
                job.status === 'failed'
                  ? 'warning.main'
                  : job.status === 'skipped' || job.status === 'pending'
                    ? 'info.main'
                    : 'primary.main',
              '&:hover': {
                backgroundColor:
                  job.status === 'failed'
                    ? 'warning.light'
                    : job.status === 'skipped' || job.status === 'pending'
                      ? 'info.light'
                      : 'primary.light',
                color: 'white',
              },
            }}
          >
            <SyncIcon fontSize="small" />
          </IconButton>
        ) : undefined
      }
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
                sx={{ ml: 'auto', mr: showRerunButton ? 4 : 0, fontFamily: 'monospace', fontWeight: 600 }}
              />
            )}
            {job.status === 'completed' && typeof job.itemsProcessed === 'number' && job.itemsProcessed > 0 && (
              <Chip
                label={t('setup.initialJobsStep.itemsProcessed', { count: job.itemsProcessed })}
                size="small"
                color="success"
                variant="outlined"
                sx={{ ml: 'auto', mr: showRerunButton ? 4 : 0, fontFamily: 'monospace' }}
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
              <LinearProgress variant="determinate" value={job.progress} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
            )}
            {job.status === 'failed' && job.error && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                {t('setup.initialJobsStep.errorPrefix')} {job.error}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  )
}

export function InitialJobsStep({ wizard }: InitialJobsStepProps) {
  const { t } = useTranslation()
  const { error, runningJobs, jobLogs, jobsProgress, currentJobIndex, runInitialJobs, runSingleJob, goToStep } = wizard
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [waitingMessageIndex, setWaitingMessageIndex] = useState(0)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const completedCount = jobsProgress.filter((j) => j.status === 'completed').length
  const skippedCount = jobsProgress.filter((j) => j.status === 'skipped').length
  const doneCount = completedCount + skippedCount
  const totalCount = jobsProgress.length
  const hasStarted = jobsProgress.length > 0
  const allCompleted = hasStarted && doneCount === totalCount
  const hasFailed = jobsProgress.some((j) => j.status === 'failed')

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [jobLogs])

  useEffect(() => {
    if (!runningJobs || allCompleted) return

    const interval = setInterval(() => {
      setWaitingMessageIndex((prev) => {
        let next = Math.floor(Math.random() * WAITING_MESSAGES.length)
        while (next === prev && WAITING_MESSAGES.length > 1) {
          next = Math.floor(Math.random() * WAITING_MESSAGES.length)
        }
        return next
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [runningJobs, allCompleted])

  const totalItemsProcessed = jobsProgress.reduce((sum, j) => sum + (j.itemsProcessed || 0), 0)
  const totalItems = jobsProgress.reduce((sum, j) => sum + (j.itemsTotal || 0), 0)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('setup.initialJobsStep.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.initialJobsStep.body')}
      </Typography>

      {!hasStarted && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={500} gutterBottom>
            {t('setup.initialJobsStep.whatHappensTitle')}
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2, '& li': { mb: 0.5 } }}>
            <li>
              <Typography variant="body2">{t('setup.initialJobsStep.bulletSyncMedia')}</Typography>
            </li>
            <li>
              <Typography variant="body2">{t('setup.initialJobsStep.bulletWatchHistory')}</Typography>
            </li>
            <li>
              <Typography variant="body2">{t('setup.initialJobsStep.bulletEmbeddings')}</Typography>
            </li>
            <li>
              <Typography variant="body2">{t('setup.initialJobsStep.bulletRecs')}</Typography>
            </li>
            <li>
              <Typography variant="body2">{t('setup.initialJobsStep.bulletLibraries')}</Typography>
            </li>
          </Box>
        </Alert>
      )}

      {!allCompleted && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={false}>
          <Typography variant="body2">
            <strong>{t('setup.initialJobsStep.headsUpLabel')}</strong> {t('setup.initialJobsStep.headsUp')}
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

      {hasStarted && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {t('setup.initialJobsStep.progressLine', { done: completedCount, total: totalCount })}
              </Typography>
              {totalItems > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('setup.initialJobsStep.itemsProcessedLine', {
                    processed: totalItemsProcessed.toLocaleString(),
                    total: totalItems.toLocaleString(),
                  })}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {allCompleted && (
                <Chip label={t('setup.initialJobsStep.chipAllComplete')} color="success" size="small" icon={<CheckCircleIcon />} />
              )}
              {hasFailed && <Chip label={t('setup.initialJobsStep.chipFailed')} color="error" size="small" icon={<ErrorIcon />} />}
              {runningJobs && !hasFailed && (
                <Chip label={t('setup.initialJobsStep.chipRunning')} color="primary" size="small" icon={<RunningIcon />} />
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

      {hasStarted && (
        <Paper variant="outlined" sx={{ mb: 3, maxHeight: 400, overflow: 'auto' }}>
          <List disablePadding sx={{ p: 1 }}>
            {jobsProgress.map((job, index) => (
              <JobListItem
                key={job.id}
                job={job}
                isActive={index === currentJobIndex}
                canRerun={!runningJobs}
                onRerun={() => runSingleJob(job.id)}
              />
            ))}
          </List>
        </Paper>
      )}

      {hasStarted && (allCompleted || hasFailed) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('setup.initialJobsStep.libraryResultsTitle')}
          </Typography>
          <LibraryResultsSummary jobs={jobsProgress} type="movies" />
          <LibraryResultsSummary jobs={jobsProgress} type="series" />
          <TopPicksResultsSummary jobs={jobsProgress} />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => goToStep('aiSetup')} disabled={runningJobs}>
          {t('setup.initialJobsStep.back')}
        </Button>

        {!hasStarted && (
          <Button
            variant="contained"
            onClick={runInitialJobs}
            disabled={runningJobs}
            startIcon={runningJobs ? <CircularProgress size={20} color="inherit" /> : <RunningIcon />}
            size="large"
          >
            {t('setup.initialJobsStep.startInit')}
          </Button>
        )}

        {hasStarted && runningJobs && !hasFailed && (
          <Button variant="contained" disabled startIcon={<CircularProgress size={20} color="inherit" />}>
            {t('setup.initialJobsStep.runningProgress', { done: completedCount, total: totalCount })}
          </Button>
        )}

        {hasStarted && !runningJobs && !allCompleted && !hasFailed && (
          <Button variant="contained" onClick={runInitialJobs} startIcon={<RunningIcon />}>
            {t('setup.initialJobsStep.continueProgress', { done: completedCount, total: totalCount })}
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
            {t('setup.initialJobsStep.retry')}
          </Button>
        )}

        {hasStarted && (
          <Button
            variant="outlined"
            onClick={() => setLogModalOpen(true)}
            startIcon={<TerminalIcon />}
            color={runningJobs ? 'primary' : 'inherit'}
          >
            {t('setup.initialJobsStep.viewLogs')}
            {runningJobs && ` ${t('setup.initialJobsStep.viewLogsLive')}`} ({jobLogs.length})
          </Button>
        )}

        {allCompleted && (
          <Button variant="contained" color="success" onClick={() => goToStep('complete')}>
            {t('setup.initialJobsStep.continueFinish')}
          </Button>
        )}
      </Box>

      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerminalIcon />
            <Typography variant="h6">{t('setup.initialJobsStep.logsTitle')}</Typography>
            <Chip label={t('setup.initialJobsStep.logEntries', { count: jobLogs.length })} size="small" variant="outlined" />
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
                let color = '#c9d1d9'
                if (log.includes('✗') || log.includes('ERROR') || log.includes('FAILED')) {
                  color = '#f85149'
                } else if (log.includes('✓') || log.includes('Completed') || log.includes('successfully')) {
                  color = '#3fb950'
                } else if (log.includes('▶') || log.includes('Starting')) {
                  color = '#58a6ff'
                } else if (log.includes('⚠')) {
                  color = '#d29922'
                } else if (log.includes('•')) {
                  color = '#8b949e'
                } else if (log.includes('→')) {
                  color = '#a5d6ff'
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
                {t('setup.initialJobsStep.noLogsYet')}
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('setup.initialJobsStep.logsFooter', {
              status: runningJobs ? t('setup.initialJobsStep.logsStreaming') : t('setup.initialJobsStep.logsComplete'),
            })}
          </Typography>
          <Button onClick={() => setLogModalOpen(false)}>{t('setup.initialJobsStep.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
