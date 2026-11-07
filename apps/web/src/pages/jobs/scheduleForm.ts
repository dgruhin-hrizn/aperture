import type { UpdateJobConfigParams } from './hooks/useJobsData'
import type { ScheduleType } from './types'

export function jobSchedulePayload(input: {
  type: ScheduleType
  enabled: boolean
  hour: number
  minute: number
  dayOfWeek: number
  intervalMinutes: number
}): UpdateJobConfigParams & { scheduleType: ScheduleType; isEnabled: boolean } {
  return {
    scheduleType: input.type,
    isEnabled: input.enabled,
    scheduleHour: input.type === 'daily' || input.type === 'weekly' ? input.hour : null,
    scheduleMinute: input.minute,
    scheduleDayOfWeek: input.type === 'weekly' ? input.dayOfWeek : null,
    scheduleIntervalHours:
      input.type === 'interval' && input.intervalMinutes >= 60 ? input.intervalMinutes / 60 : null,
    scheduleIntervalMinutes:
      input.type === 'interval' && input.intervalMinutes < 60 ? input.intervalMinutes : null,
  }
}
