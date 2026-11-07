import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import cron from 'node-cron'
import { getPool, createJobProgress, setJobStep } from '@aperture/core'
import {
  initializeScheduler,
  stopScheduler,
  getScheduledJobTiming,
  refreshJobSchedule,
} from './scheduler.js'
import { registerListHandlers } from '../routes/jobs/handlers/list.js'
import { registerConfigHandlers } from '../routes/jobs/handlers/config.js'
import { activeJobs } from '../routes/jobs/state.js'

test('job API times describe the registered cron and update when that task is rescheduled', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const previousZone = process.env.TZ
  process.env.TZ = 'America/New_York'
  t.after(() => {
    stopScheduler()
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  })
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T12:50:00Z') })
  let minute = 23
  const registrations: Array<{ cron: string; timeZone?: string }> = []
  t.mock.method(
    cron,
    'schedule',
    (expression: string, _callback: unknown, options?: { timezone?: string }) => {
      registrations.push({ cron: expression, timeZone: options?.timezone })
      return { stop() {} } as unknown as ReturnType<typeof cron.schedule>
    }
  )
  t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    const rows =
      sql.includes('FROM job_config') && (!params.length || params[0] === 'sync-series')
        ? [
            {
              job_name: 'sync-series',
              schedule_type: 'interval',
              schedule_hour: null,
              schedule_minute: minute,
              schedule_interval_hours: 6,
              schedule_interval_minutes: null,
              is_enabled: true,
              updated_at: new Date(),
            },
          ]
        : []
    return { rows, rowCount: rows.length }
  })
  await initializeScheduler()
  assert.ok(
    registrations.some(
      (task) => task.cron === '23 */6 * * *' && task.timeZone === 'America/New_York'
    )
  )
  minute = 29
  assert.equal(getScheduledJobTiming('sync-series').nextRunAt, '2026-11-07T17:23:00.000Z')
  const server = Fastify({ ajv: { customOptions: { strict: false } } })
  t.after(() => server.close())
  const jobId = '20000000-0000-4000-8000-000000000001'
  createJobProgress(jobId, 'sync-series', 1)
  setJobStep(jobId, 0, 'Waiting for other Emby work to finish')
  activeJobs.set('sync-series', jobId)
  t.after(() => activeJobs.delete('sync-series'))
  await registerListHandlers(server)
  const response = await server.inject({
    url: '/api/jobs',
    headers: { 'x-internal-request': 'true' },
  })
  assert.equal(response.statusCode, 200)
  const job = response.json().jobs.find((entry: { name: string }) => entry.name === 'sync-series')
  assert.equal(job.cron, '23 */6 * * *')
  assert.equal(job.schedule.nextRunAt, '2026-11-07T17:23:00.000Z')
  assert.equal(job.schedule.timeZone, 'America/New_York')
  assert.equal(job.progress.queued, true)
  setJobStep(jobId, 0, 'Syncing catalog')
  const running = await server.inject({
    url: '/api/jobs',
    headers: { 'x-internal-request': 'true' },
  })
  assert.equal(
    running.json().jobs.find((entry: { name: string }) => entry.name === 'sync-series').progress
      .queued,
    false
  )
  await refreshJobSchedule('sync-series')
  assert.equal(getScheduledJobTiming('sync-series').nextRunAt, '2026-11-07T17:29:00.000Z')
})

test('schedule updates report a scheduler failure instead of claiming it was applied', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  t.mock.method(getPool(), 'query', async () => ({
    rows: [
      {
        job_name: 'sync-series',
        schedule_type: 'interval',
        schedule_hour: null,
        schedule_minute: 23,
        schedule_interval_hours: 6,
        schedule_interval_minutes: null,
        is_enabled: true,
        updated_at: new Date(),
      },
    ],
    rowCount: 1,
  }))
  t.mock.method(cron, 'schedule', () => {
    throw new Error('scheduler fixture unavailable')
  })
  const server = Fastify({ ajv: { customOptions: { strict: false } } })
  t.after(() => {
    stopScheduler()
    return server.close()
  })
  await registerConfigHandlers(server)
  const response = await server.inject({
    method: 'PATCH',
    url: '/api/jobs/sync-series/config',
    headers: { 'x-internal-request': 'true' },
    payload: { scheduleMinute: 23 },
  })
  assert.equal(response.statusCode, 503)
  assert.match(response.json().error, /saved.*could not apply/)
})
