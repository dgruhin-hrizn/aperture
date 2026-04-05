import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Switch,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { ScheduleType, JobSchedule } from '../types'
import { formatJobName } from '../constants'

interface JobConfigDialogProps {
  open: boolean
  onClose: () => void
  jobName: string
  currentSchedule: JobSchedule | null | undefined
  manualOnly?: boolean
  onSave: (schedule: {
    scheduleType: ScheduleType
    scheduleHour: number | null
    scheduleMinute: number | null
    scheduleDayOfWeek: number | null
    scheduleIntervalHours: number | null
    scheduleIntervalMinutes: number | null
    isEnabled: boolean
  }) => Promise<void>
}

const WEEKDAY_KEYS = [
  'weekdaySun',
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
] as const

const INTERVAL_META: { value: number; labelKey: string }[] = [
  { value: 15, labelKey: 'intervalEvery15m' },
  { value: 30, labelKey: 'intervalEvery30m' },
  { value: 60, labelKey: 'intervalEveryHour' },
  { value: 120, labelKey: 'intervalEvery2h' },
  { value: 180, labelKey: 'intervalEvery3h' },
  { value: 240, labelKey: 'intervalEvery4h' },
  { value: 360, labelKey: 'intervalEvery6h' },
  { value: 480, labelKey: 'intervalEvery8h' },
  { value: 720, labelKey: 'intervalEvery12h' },
]

export function JobConfigDialog({
  open,
  onClose,
  jobName,
  currentSchedule,
  manualOnly = false,
  onSave,
}: JobConfigDialogProps) {
  const { t } = useTranslation()
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily')
  const [hour, setHour] = useState<number>(3)
  const [dayOfWeek, setDayOfWeek] = useState<number>(0)
  const [intervalMinutesTotal, setIntervalMinutesTotal] = useState<number>(360)
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        value: i,
        label:
          i === 0
            ? t('admin.jobsPage.ui.hour12am')
            : i < 12
              ? t('admin.jobsPage.ui.hourAm', { hour: i })
              : i === 12
                ? t('admin.jobsPage.ui.hour12pm')
                : t('admin.jobsPage.ui.hourPm', { hour: i - 12 }),
      })),
    [t]
  )

  const daysOfWeek = useMemo(
    () =>
      WEEKDAY_KEYS.map((key, value) => ({
        value,
        label: t(`admin.jobsPage.ui.${key}`),
      })),
    [t]
  )

  const intervalOptions = useMemo(
    () =>
      INTERVAL_META.map(({ value, labelKey }) => ({
        value,
        label: t(`admin.jobsPage.ui.${labelKey}`),
      })),
    [t]
  )

  useEffect(() => {
    if (open && !initialized && currentSchedule) {
      setScheduleType(currentSchedule.type)
      setHour(currentSchedule.hour ?? 3)
      setDayOfWeek(currentSchedule.dayOfWeek ?? 0)
      setIntervalMinutesTotal(
        currentSchedule.intervalMinutes ??
          (currentSchedule.intervalHours != null ? currentSchedule.intervalHours * 60 : 360)
      )
      setIsEnabled(currentSchedule.isEnabled)
      setInitialized(true)
    }
    if (!open) {
      setInitialized(false)
      setError(null)
    }
  }, [open, initialized, currentSchedule])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const subHour = scheduleType === 'interval' && intervalMinutesTotal < 60
      await onSave({
        scheduleType,
        scheduleHour: scheduleType === 'interval' || scheduleType === 'manual' ? null : hour,
        scheduleMinute: scheduleType === 'interval' || scheduleType === 'manual' ? null : 0,
        scheduleDayOfWeek: scheduleType === 'weekly' ? dayOfWeek : null,
        scheduleIntervalHours:
          scheduleType === 'interval' && !subHour ? intervalMinutesTotal / 60 : null,
        scheduleIntervalMinutes: scheduleType === 'interval' && subHour ? intervalMinutesTotal : null,
        isEnabled,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.jobsPage.ui.configFailedSave'))
    } finally {
      setSaving(false)
    }
  }

  const getPreviewText = (): string => {
    if (manualOnly) return t('admin.jobsPage.ui.configPreviewManualOnly')
    if (!isEnabled) return t('admin.jobsPage.ui.configPreviewDisabled')

    const timeLabel = hours.find((h) => h.value === hour)?.label ?? ''
    switch (scheduleType) {
      case 'daily':
        return t('admin.jobsPage.ui.configPreviewDaily', { time: timeLabel })
      case 'weekly': {
        const dayLabel = daysOfWeek.find((d) => d.value === dayOfWeek)?.label ?? ''
        return t('admin.jobsPage.ui.configPreviewWeekly', { day: dayLabel, time: timeLabel })
      }
      case 'interval':
        return (
          intervalOptions.find((i) => i.value === intervalMinutesTotal)?.label ||
          t('admin.jobsPage.ui.intervalFallback')
        )
      case 'manual':
        return t('admin.jobsPage.ui.configPreviewManualRuns')
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {t('admin.jobsPage.ui.configTitle', { name: formatJobName(jobName, t) })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {manualOnly && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon />}
              sx={{
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('admin.jobsPage.ui.configManualOnlyTitle')}
              </Typography>
              <Typography variant="body2">{t('admin.jobsPage.ui.configManualOnlyBody')}</Typography>
            </Alert>
          )}

          <FormControlLabel
            disabled={manualOnly}
            control={
              <Switch
                checked={manualOnly ? false : isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body1" fontWeight={500} color={manualOnly ? 'text.disabled' : 'text.primary'}>
                {t('admin.jobsPage.ui.configEnableScheduling')}
              </Typography>
            }
          />

          <FormControl disabled={!isEnabled || manualOnly}>
            <FormLabel sx={{ mb: 1, fontWeight: 500 }}>{t('admin.jobsPage.ui.configRunFrequency')}</FormLabel>
            <RadioGroup
              value={manualOnly ? 'manual' : scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
            >
              <FormControlLabel
                value="daily"
                control={<Radio />}
                label={t('admin.jobsPage.ui.configDaily')}
                disabled={manualOnly}
              />
              <FormControlLabel
                value="weekly"
                control={<Radio />}
                label={t('admin.jobsPage.ui.configWeekly')}
                disabled={manualOnly}
              />
              <FormControlLabel
                value="interval"
                control={<Radio />}
                label={t('admin.jobsPage.ui.configInterval')}
                disabled={manualOnly}
              />
              <FormControlLabel value="manual" control={<Radio />} label={t('admin.jobsPage.ui.configManualOnlyOption')} />
            </RadioGroup>
          </FormControl>

          {isEnabled && (scheduleType === 'daily' || scheduleType === 'weekly') && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>{t('admin.jobsPage.ui.configTime')}</FormLabel>
              <Select value={hour} onChange={(e) => setHour(e.target.value as number)} size="small">
                {hours.map((h) => (
                  <MenuItem key={h.value} value={h.value}>
                    {h.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {isEnabled && scheduleType === 'weekly' && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>{t('admin.jobsPage.ui.configDayOfWeek')}</FormLabel>
              <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as number)} size="small">
                {daysOfWeek.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {isEnabled && scheduleType === 'interval' && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>{t('admin.jobsPage.ui.configInterval')}</FormLabel>
              <Select
                value={intervalMinutesTotal}
                onChange={(e) => setIntervalMinutesTotal(e.target.value as number)}
                size="small"
              >
                {intervalOptions.map((i) => (
                  <MenuItem key={i.value} value={i.value}>
                    {i.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              {t('admin.jobsPage.ui.schedulePreview')}
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {getPreviewText()}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
