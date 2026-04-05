import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  Typography,
  Stack,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import HistoryIcon from '@mui/icons-material/History'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import BlockIcon from '@mui/icons-material/Block'
import {
  JOB_ICONS,
  JOB_COLORS,
  formatJobName,
  formatRelativePastTime,
  formatJobDurationMsOrDash,
} from '../constants'
import type { Job, JobSchedule } from '../types'

interface ScheduleTableProps {
  jobs: Job[]
  onConfigClick: (jobName: string) => void
  onHistoryClick: (jobName: string) => void
  onRunJob: (jobName: string) => void
  onToggleEnabled: (jobName: string, enabled: boolean) => void
}

function getNextRunTime(schedule: JobSchedule | null, t: TFunction): string {
  if (!schedule || !schedule.isEnabled || schedule.type === 'manual') {
    return t('admin.jobsPage.ui.dash')
  }
  
  const now = new Date()
  const targetHour = schedule.hour ?? 0
  const targetMinute = schedule.minute ?? 0
  
  const nextRun = new Date()
  
  if (schedule.type === 'daily') {
    nextRun.setHours(targetHour, targetMinute, 0, 0)
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  } else if (schedule.type === 'weekly') {
    const targetDay = schedule.dayOfWeek ?? 0
    nextRun.setHours(targetHour, targetMinute, 0, 0)
    const daysUntil = (targetDay - now.getDay() + 7) % 7
    if (daysUntil === 0 && nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 7)
    } else {
      nextRun.setDate(nextRun.getDate() + daysUntil)
    }
  } else if (schedule.type === 'interval') {
    const intervalMins =
      schedule.intervalMinutes ?? (schedule.intervalHours ?? 1) * 60
    const ms = intervalMins * 60 * 1000
    const next = new Date(Math.ceil(now.getTime() / ms) * ms)
    nextRun.setTime(next.getTime())
  }
  
  // Format relative time
  const diff = nextRun.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return t('admin.jobsPage.ui.nextInDaysHours', { days, hours: hours % 24 })
  }
  if (hours > 0) {
    return t('admin.jobsPage.ui.nextInHoursMinutes', { hours, minutes })
  }
  return t('admin.jobsPage.ui.nextInMinutes', { minutes })
}

function formatLastRun(lastRun: Job['lastRun'], t: TFunction): string {
  if (!lastRun) return t('admin.jobsPage.ui.dateNever')
  return formatRelativePastTime(lastRun.startedAt, t)
}

/**
 * Calculate minutes until next run for sorting
 */
function getMinutesUntilNextRun(schedule: JobSchedule | null | undefined): number {
  if (!schedule || !schedule.isEnabled || schedule.type === 'manual') {
    return Infinity // Manual/disabled jobs sort to the end
  }
  
  const now = new Date()
  const targetHour = schedule.hour ?? 0
  const targetMinute = schedule.minute ?? 0
  
  const nextRun = new Date()
  
  if (schedule.type === 'daily') {
    nextRun.setHours(targetHour, targetMinute, 0, 0)
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  } else if (schedule.type === 'weekly') {
    const targetDay = schedule.dayOfWeek ?? 0
    nextRun.setHours(targetHour, targetMinute, 0, 0)
    const daysUntil = (targetDay - now.getDay() + 7) % 7
    if (daysUntil === 0 && nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 7)
    } else {
      nextRun.setDate(nextRun.getDate() + daysUntil)
    }
  } else if (schedule.type === 'interval') {
    const intervalMins =
      schedule.intervalMinutes ?? (schedule.intervalHours ?? 1) * 60
    const ms = intervalMins * 60 * 1000
    const next = new Date(Math.ceil(now.getTime() / ms) * ms)
    nextRun.setTime(next.getTime())
  }
  
  return Math.floor((nextRun.getTime() - now.getTime()) / (1000 * 60))
}

export function ScheduleTable({
  jobs,
  onConfigClick,
  onHistoryClick,
  onRunJob,
  onToggleEnabled,
}: ScheduleTableProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  // Sort jobs: running first, then by next run time, then manual, then disabled
  const sortedJobs = [...jobs].sort((a, b) => {
    const aRunning = a.status === 'running'
    const bRunning = b.status === 'running'
    const aEnabled = a.schedule?.isEnabled ?? false
    const bEnabled = b.schedule?.isEnabled ?? false
    const aManual = a.schedule?.type === 'manual'
    const bManual = b.schedule?.type === 'manual'
    
    // 1. Running jobs first
    if (aRunning && !bRunning) return -1
    if (bRunning && !aRunning) return 1
    
    // 2. Disabled jobs last
    if (!aEnabled && bEnabled) return 1
    if (aEnabled && !bEnabled) return -1
    
    // 3. Manual jobs after scheduled jobs
    if (aManual && !bManual) return 1
    if (bManual && !aManual) return -1
    
    // 4. Both are scheduled - sort by next run time (soonest first)
    if (!aManual && !bManual && aEnabled && bEnabled) {
      const aMinutes = getMinutesUntilNextRun(a.schedule)
      const bMinutes = getMinutesUntilNextRun(b.schedule)
      if (aMinutes !== bMinutes) return aMinutes - bMinutes
    }
    
    // 5. Fallback to alphabetical
    return a.name.localeCompare(b.name)
  })

  // Mobile card view
  if (isMobile) {
    return (
      <Stack spacing={2}>
        {sortedJobs.map((job) => {
          const isManual = job.schedule?.type === 'manual'
          const isEnabled = job.schedule?.isEnabled ?? true
          const isRunning = job.status === 'running'
          
          return (
            <Card
              key={job.name}
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                opacity: isEnabled ? 1 : 0.6,
              }}
            >
              <CardContent>
                {/* Header with job name and enabled toggle */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                    <Box sx={{ color: JOB_COLORS[job.name] || 'text.secondary' }}>
                      {JOB_ICONS[job.name]}
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {formatJobName(job.name, t)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {job.schedule?.formatted || t('admin.jobsPage.ui.manualOnlyShort')}
                      </Typography>
                    </Box>
                  </Stack>
                  <Switch
                    size="small"
                    checked={isEnabled && !isManual}
                    disabled={isManual}
                    onChange={(e) => onToggleEnabled(job.name, e.target.checked)}
                  />
                </Stack>

                {/* Status and timing info */}
                <Stack spacing={1} mb={2}>
                  {/* Status */}
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                      {t('admin.jobsPage.ui.mobileStatus')}
                    </Typography>
                    {isRunning ? (
                      <Chip
                        size="small"
                        label={t('admin.jobsPage.ui.statusRunning')}
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          height: 20,
                          fontSize: '0.7rem',
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.7 },
                          },
                        }}
                      />
                    ) : job.lastRun?.status === 'completed' ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        <Typography variant="caption" color="success.main">
                          {t('admin.jobsPage.ui.statusOk')}
                        </Typography>
                      </Stack>
                    ) : job.lastRun?.status === 'failed' ? (
                      <Tooltip title={job.lastRun.errorMessage || t('admin.jobsPage.ui.unknownError')}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
                          <Typography variant="caption" color="error.main">
                            {t('admin.jobsPage.ui.statusFailed')}
                          </Typography>
                        </Stack>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {t('admin.jobsPage.ui.dash')}
                      </Typography>
                    )}
                  </Stack>

                  {/* Next Run */}
                  {!isManual && isEnabled && (
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                        {t('admin.jobsPage.ui.mobileNextRun')}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {getNextRunTime(job.schedule ?? null, t)}
                        </Typography>
                      </Stack>
                    </Stack>
                  )}

                  {/* Last Run */}
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                      {t('admin.jobsPage.ui.mobileLastRun')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatLastRun(job.lastRun, t)}
                    </Typography>
                  </Stack>

                  {/* Duration */}
                  {job.lastRun?.durationMs && (
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                        {t('admin.jobsPage.ui.mobileDuration')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatJobDurationMsOrDash(job.lastRun.durationMs, t)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {/* Actions */}
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Tooltip title={t('admin.jobsPage.ui.tooltipRunNow')}>
                    <IconButton
                      size="small"
                      onClick={() => onRunJob(job.name)}
                      disabled={isRunning}
                      sx={{
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                    >
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('admin.jobsPage.ui.tooltipScheduleSettings')}>
                    <IconButton
                      size="small"
                      onClick={() => onConfigClick(job.name)}
                      sx={{
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                    >
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('admin.jobsPage.ui.tooltipViewHistory')}>
                    <IconButton
                      size="small"
                      onClick={() => onHistoryClick(job.name)}
                      sx={{
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          )
        })}
      </Stack>
    )
  }

  // Desktop table view
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('admin.jobsPage.ui.scheduleColEnabled')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColJob')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColSchedule')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColNextRun')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColLastRun')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColDuration')}</TableCell>
            <TableCell>{t('admin.jobsPage.ui.scheduleColStatus')}</TableCell>
            <TableCell align="right">{t('admin.jobsPage.ui.scheduleColActions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedJobs.map((job) => {
            const isManual = job.schedule?.type === 'manual'
            const isManualOnly = job.manualOnly === true
            const isEnabled = job.schedule?.isEnabled ?? true
            const isRunning = job.status === 'running'
            
            return (
              <TableRow 
                key={job.name}
                sx={{ 
                  opacity: isEnabled ? 1 : 0.6,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {/* Enabled Toggle */}
                <TableCell>
                  {isManualOnly ? (
                    <Tooltip title={t('admin.jobsPage.ui.tooltipCannotSchedule')}>
                      <BlockIcon fontSize="small" sx={{ color: 'text.disabled', ml: 1 }} />
                    </Tooltip>
                  ) : (
                    <Switch
                      size="small"
                      checked={isEnabled && !isManual}
                      disabled={isManual}
                      onChange={(e) => onToggleEnabled(job.name, e.target.checked)}
                    />
                  )}
                </TableCell>
                
                {/* Job Name */}
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: JOB_COLORS[job.name] || 'text.secondary' }}>
                      {JOB_ICONS[job.name]}
                    </Box>
                    <Typography variant="body2" fontWeight={500}>
                      {formatJobName(job.name, t)}
                    </Typography>
                  </Stack>
                </TableCell>
                
                {/* Schedule Type */}
                <TableCell>
                  <Typography variant="body2" color={isManualOnly ? 'warning.main' : 'text.secondary'}>
                    {isManualOnly
                      ? t('admin.jobsPage.ui.manualOnlyCaption')
                      : job.schedule?.formatted || t('admin.jobsPage.ui.manualOnlyShort')}
                  </Typography>
                </TableCell>
                
                {/* Next Run */}
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {!isManual && isEnabled && (
                      <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {getNextRunTime(job.schedule ?? null, t)}
                    </Typography>
                  </Stack>
                </TableCell>
                
                {/* Last Run */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatLastRun(job.lastRun, t)}
                  </Typography>
                </TableCell>
                
                {/* Duration */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatJobDurationMsOrDash(job.lastRun?.durationMs ?? null, t)}
                  </Typography>
                </TableCell>
                
                {/* Status */}
                <TableCell>
                  {isRunning ? (
                    <Chip
                      size="small"
                      label={t('admin.jobsPage.ui.statusRunning')}
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.7 },
                        },
                      }}
                    />
                  ) : job.lastRun?.status === 'completed' ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="body2" color="success.main">
                        {t('admin.jobsPage.ui.statusOk')}
                      </Typography>
                    </Stack>
                  ) : job.lastRun?.status === 'failed' ? (
                    <Tooltip title={job.lastRun.errorMessage || t('admin.jobsPage.ui.unknownError')}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        <Typography variant="body2" color="error.main">
                          {t('admin.jobsPage.ui.statusFailed')}
                        </Typography>
                      </Stack>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.jobsPage.ui.dash')}
                    </Typography>
                  )}
                </TableCell>
                
                {/* Actions */}
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title={t('admin.jobsPage.ui.tooltipRunNow')}>
                      <IconButton
                        size="small"
                        onClick={() => onRunJob(job.name)}
                        disabled={isRunning}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        isManualOnly
                          ? t('admin.jobsPage.ui.tooltipViewJobInfo')
                          : t('admin.jobsPage.ui.tooltipScheduleSettings')
                      }
                    >
                      <IconButton
                        size="small"
                        onClick={() => onConfigClick(job.name)}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('admin.jobsPage.ui.tooltipViewHistory')}>
                      <IconButton
                        size="small"
                        onClick={() => onHistoryClick(job.name)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

