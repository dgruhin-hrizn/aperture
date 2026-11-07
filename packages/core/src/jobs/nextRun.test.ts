import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getNextJobRunAt } from './nextRun.js'
import type { JobConfig } from './jobConfig.js'

function schedule(patch: Partial<JobConfig> = {}): JobConfig {
  return {
    jobName: 'fixture',
    scheduleType: 'interval',
    scheduleHour: 0,
    scheduleMinute: 0,
    scheduleDayOfWeek: null,
    scheduleIntervalHours: 1,
    scheduleIntervalMinutes: null,
    isEnabled: true,
    updatedAt: new Date(0),
    ...patch,
  }
}

test('matches the offset examples shown on the job cards at 7:50 Eastern', () => {
  const now = new Date('2026-11-07T12:50:00Z')
  assert.equal(getNextJobRunAt(schedule({ scheduleMinute: 45 }), now), '2026-11-07T13:45:00.000Z')
  assert.equal(getNextJobRunAt(schedule({ scheduleMinute: 5 }), now), '2026-11-07T13:05:00.000Z')
  assert.equal(
    getNextJobRunAt(schedule({ scheduleMinute: 15, scheduleIntervalHours: 2 }), now),
    '2026-11-07T13:15:00.000Z'
  )
  assert.equal(
    getNextJobRunAt(schedule({ scheduleIntervalHours: null, scheduleIntervalMinutes: 30 }), now),
    '2026-11-07T13:00:00.000Z'
  )
  assert.equal(
    getNextJobRunAt(schedule({ scheduleMinute: 20, scheduleIntervalHours: 3 }), now),
    '2026-11-07T14:20:00.000Z'
  )
})

test('daily and weekly schedules use the server time zone and local calendar', () => {
  assert.equal(
    getNextJobRunAt(
      schedule({ scheduleType: 'daily', scheduleHour: 2, scheduleMinute: 10 }),
      new Date('2026-11-07T12:50:00Z')
    ),
    '2026-11-08T07:10:00.000Z'
  )
  assert.equal(
    getNextJobRunAt(
      schedule({ scheduleType: 'weekly', scheduleHour: 4, scheduleDayOfWeek: 0 }),
      new Date('2026-11-07T12:50:00Z')
    ),
    '2026-11-08T09:00:00.000Z'
  )
  assert.equal(
    getNextJobRunAt(
      schedule({ scheduleMinute: 5, scheduleIntervalHours: 3 }),
      new Date('2026-11-07T12:50:00Z'),
      'Asia/Kolkata'
    ),
    '2026-11-07T15:35:00.000Z'
  )
})

test('rolls forward strictly at a boundary and respects disabled and manual jobs', () => {
  const now = new Date('2026-11-07T13:05:00Z')
  assert.equal(getNextJobRunAt(schedule({ scheduleMinute: 5 }), now), '2026-11-07T14:05:00.000Z')
  assert.equal(getNextJobRunAt(schedule({ isEnabled: false }), now), null)
  assert.equal(getNextJobRunAt(schedule({ scheduleType: 'manual' }), now), null)
  assert.equal(
    getNextJobRunAt(
      schedule({ scheduleIntervalHours: null, scheduleIntervalMinutes: 15, scheduleMinute: 7 }),
      new Date('2026-11-07T13:15:00Z')
    ),
    '2026-11-07T13:30:00.000Z'
  )
})

test('skips a nonexistent spring-forward time and handles the fall-back offset', () => {
  const daily = schedule({ scheduleType: 'daily', scheduleHour: 2, scheduleMinute: 30 })
  assert.equal(getNextJobRunAt(daily, new Date('2027-03-14T06:00:00Z')), '2027-03-15T06:30:00.000Z')
  assert.equal(
    getNextJobRunAt(
      { ...daily, scheduleType: 'weekly', scheduleDayOfWeek: 0 },
      new Date('2027-03-07T08:00:00Z')
    ),
    '2027-03-21T06:30:00.000Z'
  )
  assert.equal(
    getNextJobRunAt(schedule({ scheduleMinute: 5 }), new Date('2026-11-01T04:50:00Z')),
    '2026-11-01T05:05:00.000Z'
  )
})
