import React, { useState, useEffect } from 'react'
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
    isEnabled: boolean
  }) => Promise<void>
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}))

const INTERVAL_OPTIONS = [
  { value: 1, label: 'Every hour' },
  { value: 2, label: 'Every 2 hours' },
  { value: 3, label: 'Every 3 hours' },
  { value: 4, label: 'Every 4 hours' },
  { value: 6, label: 'Every 6 hours' },
  { value: 8, label: 'Every 8 hours' },
  { value: 12, label: 'Every 12 hours' },
]

export function JobConfigDialog({
  open,
  onClose,
  jobName,
  currentSchedule,
  manualOnly = false,
  onSave,
}: JobConfigDialogProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily')
  const [hour, setHour] = useState<number>(3)
  const [dayOfWeek, setDayOfWeek] = useState<number>(0)
  const [intervalHours, setIntervalHours] = useState<number>(6)
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Initialize form from current schedule only when dialog opens
  useEffect(() => {
    if (open && !initialized && currentSchedule) {
      setScheduleType(currentSchedule.type)
      setHour(currentSchedule.hour ?? 3)
      setDayOfWeek(currentSchedule.dayOfWeek ?? 0)
      setIntervalHours(currentSchedule.intervalHours ?? 6)
      setIsEnabled(currentSchedule.isEnabled)
      setInitialized(true)
    }
    // Reset initialized flag when dialog closes
    if (!open) {
      setInitialized(false)
      setError(null)
    }
  }, [open, initialized, currentSchedule])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      await onSave({
        scheduleType,
        scheduleHour: scheduleType === 'interval' || scheduleType === 'manual' ? null : hour,
        scheduleMinute: scheduleType === 'interval' || scheduleType === 'manual' ? null : 0,
        scheduleDayOfWeek: scheduleType === 'weekly' ? dayOfWeek : null,
        scheduleIntervalHours: scheduleType === 'interval' ? intervalHours : null,
        isEnabled,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const getPreviewText = (): string => {
    if (manualOnly) return 'Manual only - this job cannot be scheduled'
    if (!isEnabled) return 'Job is disabled'
    
    switch (scheduleType) {
      case 'daily':
        return `Runs daily at ${HOURS.find((h) => h.value === hour)?.label}`
      case 'weekly':
        return `Runs every ${DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label} at ${HOURS.find((h) => h.value === hour)?.label}`
      case 'interval':
        return INTERVAL_OPTIONS.find((i) => i.value === intervalHours)?.label || 'Every X hours'
      case 'manual':
        return 'Manual only - no automatic runs'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Configure {formatJobName(jobName)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Manual-Only Warning */}
          {manualOnly && (
            <Alert 
              severity="warning" 
              icon={<WarningAmberIcon />}
              sx={{ 
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Manual-Only Job
              </Typography>
              <Typography variant="body2">
                This job deletes all existing data before rebuilding. It cannot be scheduled and must be run manually. Use only after major algorithm changes, embedding model changes, or if recommendations appear corrupted.
              </Typography>
            </Alert>
          )}

          {/* Enable/Disable Toggle */}
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
                Enable automatic scheduling
              </Typography>
            }
          />

          {/* Schedule Type */}
          <FormControl disabled={!isEnabled || manualOnly}>
            <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Run Frequency</FormLabel>
            <RadioGroup
              value={manualOnly ? 'manual' : scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
            >
              <FormControlLabel value="daily" control={<Radio />} label="Daily" disabled={manualOnly} />
              <FormControlLabel value="weekly" control={<Radio />} label="Weekly" disabled={manualOnly} />
              <FormControlLabel value="interval" control={<Radio />} label="Every X hours" disabled={manualOnly} />
              <FormControlLabel value="manual" control={<Radio />} label="Manual only" />
            </RadioGroup>
          </FormControl>

          {/* Time Selection (for daily/weekly) */}
          {isEnabled && (scheduleType === 'daily' || scheduleType === 'weekly') && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Time</FormLabel>
              <Select
                value={hour}
                onChange={(e) => setHour(e.target.value as number)}
                size="small"
              >
                {HOURS.map((h) => (
                  <MenuItem key={h.value} value={h.value}>
                    {h.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Day of Week (for weekly) */}
          {isEnabled && scheduleType === 'weekly' && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Day of Week</FormLabel>
              <Select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as number)}
                size="small"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Interval Selection */}
          {isEnabled && scheduleType === 'interval' && (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Interval</FormLabel>
              <Select
                value={intervalHours}
                onChange={(e) => setIntervalHours(e.target.value as number)}
                size="small"
              >
                {INTERVAL_OPTIONS.map((i) => (
                  <MenuItem key={i.value} value={i.value}>
                    {i.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Preview */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Schedule Preview
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
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

