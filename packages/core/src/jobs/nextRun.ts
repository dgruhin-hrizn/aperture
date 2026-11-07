import { Temporal } from '@js-temporal/polyfill'
import { scheduleToCron, type JobConfig } from './jobConfig.js'

export const DEFAULT_JOB_TIMEZONE = 'America/New_York'
const cache = new Map<string, { from: number; next: number }>()

/** Match the scheduler's local calendar, rather than rounding a UTC interval. */
export function getNextJobRunAt(
  config: JobConfig,
  now = new Date(),
  timeZone = DEFAULT_JOB_TIMEZONE
): string | null {
  const cron = scheduleToCron(config)
  if (!cron) return null
  const current = now.getTime()
  const key = `${config.jobName}:${timeZone}:${cron}`
  const saved = cache.get(key)
  if (saved && saved.from <= current && saved.next > current)
    return new Date(saved.next).toISOString()
  const today = Temporal.Instant.fromEpochMilliseconds(current)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
  const subHour = config.scheduleType === 'interval' ? config.scheduleIntervalMinutes : null
  const hours =
    config.scheduleType === 'interval'
      ? Array.from({ length: 24 }, (_, hour) => hour).filter(
          (hour) => subHour || hour % (config.scheduleIntervalHours ?? 1) === 0
        )
      : [config.scheduleHour ?? 0]
  const minutes =
    subHour === 15 ? [0, 15, 30, 45] : subHour === 30 ? [0, 30] : [config.scheduleMinute ?? 0]

  for (let day = 0; day <= 14; day++) {
    const date = today.add({ days: day })
    if (config.scheduleType === 'weekly' && date.dayOfWeek % 7 !== (config.scheduleDayOfWeek ?? 0))
      continue
    let next = Infinity
    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = Temporal.ZonedDateTime.from(
          {
            timeZone,
            year: date.year,
            month: date.month,
            day: date.day,
            hour,
            minute,
          },
          { disambiguation: 'earlier' }
        )
        // Cron skips local times that do not exist during a daylight-saving jump.
        if (
          !candidate.toPlainDate().equals(date) ||
          candidate.hour !== hour ||
          candidate.minute !== minute
        )
          continue
        const instant = candidate.epochMilliseconds
        if (instant > current && instant < next) next = instant
      }
    }
    if (Number.isFinite(next)) {
      cache.set(key, { from: current, next })
      return new Date(next).toISOString()
    }
  }
  return null
}
