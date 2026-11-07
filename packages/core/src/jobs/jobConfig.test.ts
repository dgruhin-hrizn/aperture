import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import pg from 'pg'
import { getPool } from '../lib/db.js'
import { getJobConfig, scheduleToCron } from './jobConfig.js'

test('missing interval offsets use staggered defaults while explicit minute zero stays unchanged', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  let minute: number | null = null
  t.mock.method(getPool(), 'query', async () => ({
    rows: [
      {
        job_name: 'sync-series',
        schedule_type: 'interval',
        schedule_interval_hours: 3,
        schedule_minute: minute,
        is_enabled: true,
        updated_at: new Date(),
      },
    ],
  }))
  assert.equal(scheduleToCron((await getJobConfig('sync-series'))!), '10 */3 * * *')
  minute = 0
  assert.equal(scheduleToCron((await getJobConfig('sync-series'))!), '0 */3 * * *')
})

test(
  'schedule repair migration preserves custom, daily, and sub-hour schedules',
  {
    skip: !process.env.APERTURE_TEST_DATABASE_URL,
  },
  async () => {
    const db = new pg.Client({ connectionString: process.env.APERTURE_TEST_DATABASE_URL })
    await db.connect()
    try {
      await db.query('BEGIN')
      await db.query(`CREATE TEMP TABLE job_config (job_name text, schedule_type text, schedule_minute int, schedule_interval_minutes int);
      INSERT INTO job_config VALUES
      ('sync-series','interval',NULL,NULL), ('sync-movie-libraries','interval',0,NULL),
      ('sync-series-libraries','daily',NULL,NULL), ('sync-trakt-ratings','interval',NULL,30)`)
      await db.query(
        await fs.readFile(
          new URL('../../../../db/migrations/0126_stagger_media_jobs.sql', import.meta.url),
          'utf8'
        )
      )
      const { rows } = await db.query('SELECT schedule_minute FROM job_config ORDER BY job_name')
      assert.deepEqual(
        rows.map((row) => row.schedule_minute),
        [0, 10, null, null]
      )
    } finally {
      await db.query('ROLLBACK')
      await db.end()
    }
  }
)
