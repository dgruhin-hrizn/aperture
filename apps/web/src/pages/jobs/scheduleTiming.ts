import type { TFunction } from 'i18next'
import type { JobSchedule } from './types'

export function nextRunTimestamp(schedule: JobSchedule | null | undefined): number {
  if (!schedule?.isEnabled || schedule.type === 'manual' || !schedule.nextRunAt) return Infinity
  const timestamp = Date.parse(schedule.nextRunAt)
  return Number.isFinite(timestamp) ? timestamp : Infinity
}

export function formatNextRun(
  schedule: JobSchedule | null | undefined,
  t: TFunction,
  now = Date.now()
): string {
  const next = nextRunTimestamp(schedule)
  if (!Number.isFinite(next)) return t('admin.jobsPage.ui.dash')
  const totalMinutes = Math.ceil(Math.max(0, next - now) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24)
    return t('admin.jobsPage.ui.nextInDaysHours', {
      days: Math.floor(hours / 24),
      hours: hours % 24,
    })
  if (hours > 0) return t('admin.jobsPage.ui.nextInHoursMinutes', { hours, minutes })
  return t('admin.jobsPage.ui.nextInMinutes', { minutes })
}

export function nextRunDescription(schedule: JobSchedule | null | undefined): string {
  const timestamp = nextRunTimestamp(schedule)
  if (!Number.isFinite(timestamp)) return ''
  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: schedule?.timeZone ?? 'UTC',
  }).format(timestamp)} (${schedule?.timeZone ?? 'UTC'})`
}
