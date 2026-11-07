import assert from 'node:assert/strict'
import { test } from 'node:test'
import pg from 'pg'
import { getPool } from '../lib/db.js'
import { setJobConfig } from './jobConfig.js'

test(
  'partial schedule updates preserve custom offsets and switch interval units atomically',
  {
    skip: !process.env.APERTURE_TEST_DATABASE_URL,
  },
  async (t) => {
    process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
    const db = new pg.Client({ connectionString: process.env.APERTURE_TEST_DATABASE_URL })
    await db.connect()
    try {
      await db.query('BEGIN')
      await db.query(`CREATE TEMP TABLE job_config (
      job_name text PRIMARY KEY, schedule_type text, schedule_hour integer, schedule_minute integer,
      schedule_day_of_week integer, schedule_interval_hours integer, schedule_interval_minutes integer,
      is_enabled boolean, updated_at timestamptz DEFAULT now(),
      CHECK (schedule_interval_hours IS NULL OR schedule_interval_minutes IS NULL)
    )`)
      t.mock.method(getPool(), 'query', (sql: string, params: unknown[]) => db.query(sql, params))
      const first = await setJobConfig('sync-series', {
        scheduleType: 'interval',
        scheduleIntervalHours: 6,
        scheduleMinute: 23,
      })
      const disabled = await setJobConfig('sync-series', { isEnabled: false })
      assert.equal(disabled.isEnabled, false)
      assert.equal(disabled.scheduleType, 'interval')
      assert.equal(disabled.scheduleIntervalHours, 6)
      assert.equal(disabled.scheduleMinute, 23)
      await setJobConfig('sync-series', { isEnabled: true })
      const subHour = await setJobConfig('sync-series', { scheduleIntervalMinutes: 30 })
      assert.equal(subHour.scheduleIntervalHours, null)
      assert.equal(subHour.scheduleIntervalMinutes, 30)
      assert.equal(subHour.scheduleMinute, 23)
      const hourly = await setJobConfig('sync-series', { scheduleIntervalHours: 3 })
      assert.equal(hourly.scheduleIntervalMinutes, null)
      assert.equal(hourly.scheduleMinute, 23)
      await Promise.all([
        setJobConfig('sync-series', { scheduleMinute: 17 }),
        setJobConfig('sync-series', { isEnabled: false }),
      ])
      const row = (await db.query("SELECT * FROM job_config WHERE job_name='sync-series'")).rows[0]
      assert.equal(row.schedule_minute, 17)
      assert.equal(row.is_enabled, false)
      assert.equal(row.schedule_interval_hours, 3)
      assert.equal(first.scheduleMinute, 23)
      const fallback = await setJobConfig('sync-movie-libraries', { isEnabled: false })
      assert.equal(fallback.scheduleType, 'interval')
      assert.equal(fallback.scheduleIntervalHours, 3)
      assert.equal(fallback.scheduleMinute, 20)
      assert.equal(fallback.isEnabled, false)
      await setJobConfig('sync-series', {
        scheduleType: 'weekly',
        scheduleHour: 4,
        scheduleDayOfWeek: 2,
      })
      const weekly = await setJobConfig('sync-series', { scheduleHour: 7, scheduleDayOfWeek: 5 })
      assert.equal(weekly.scheduleType, 'weekly')
      assert.equal(weekly.scheduleHour, 7)
      assert.equal(weekly.scheduleDayOfWeek, 5)
      assert.equal(weekly.scheduleIntervalHours, null)
      assert.equal(weekly.scheduleIntervalMinutes, null)
    } finally {
      await db.query('ROLLBACK')
      await db.end()
    }
  }
)
