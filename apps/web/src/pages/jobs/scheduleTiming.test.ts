import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TFunction } from 'i18next'
import { formatNextRun, nextRunTimestamp } from './scheduleTiming'
import { jobSchedulePayload } from './scheduleForm'
import type { JobSchedule } from './types'

const t = ((_key: string, options: Record<string, number>) =>
  JSON.stringify(options)) as unknown as TFunction
const base: JobSchedule = {
  type: 'interval',
  hour: null,
  minute: 45,
  dayOfWeek: null,
  intervalHours: 1,
  intervalMinutes: null,
  isEnabled: true,
  formatted: 'Every hour at :45',
  timeZone: 'America/New_York',
  nextRunAt: '2026-11-07T13:45:00Z',
}

test('card countdowns and sorting use the server timestamp rather than UTC interval rounding', () => {
  const now = Date.parse('2026-11-07T12:50:00Z')
  assert.equal(formatNextRun(base, t, now), JSON.stringify({ minutes: 55 }))
  assert.equal(
    formatNextRun({ ...base, nextRunAt: '2026-11-07T13:05:00Z' }, t, now),
    JSON.stringify({ minutes: 15 })
  )
  assert.equal(
    formatNextRun({ ...base, intervalHours: 2, nextRunAt: '2026-11-07T13:15:00Z' }, t, now),
    JSON.stringify({ minutes: 25 })
  )
  assert.equal(nextRunTimestamp({ ...base, isEnabled: false }), Infinity)
  assert.equal(nextRunTimestamp({ ...base, nextRunAt: null }), Infinity)
})

test('schedule saves retain minute offsets for daily, weekly and interval frequencies', () => {
  for (const type of ['daily', 'weekly', 'interval'] as const) {
    const payload = jobSchedulePayload({
      type,
      enabled: true,
      hour: 4,
      minute: 23,
      dayOfWeek: 3,
      intervalMinutes: 180,
    })
    assert.equal(payload.scheduleMinute, 23)
    assert.equal(payload.scheduleIntervalHours, type === 'interval' ? 3 : null)
    assert.equal(payload.scheduleIntervalMinutes, null)
  }
  const subHour = jobSchedulePayload({
    type: 'interval',
    enabled: true,
    hour: 0,
    minute: 23,
    dayOfWeek: 0,
    intervalMinutes: 30,
  })
  assert.equal(subHour.scheduleIntervalHours, null)
  assert.equal(subHour.scheduleIntervalMinutes, 30)
  assert.equal(subHour.scheduleMinute, 23)
})
