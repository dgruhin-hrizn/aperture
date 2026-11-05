import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { closePool, query, queryOne } from '../lib/db.js'
import { runMigrations } from '../migrations.js'
import { restoreBackup } from './backupService.js'

const database = process.env.APERTURE_TEST_DATABASE_URL

test('a failing pg_dump cannot publish a backup or allow a restore to begin', { skip: !database }, async () => {
  const fixture = new URL(database!)
  assert.ok(['localhost', '127.0.0.1'].includes(fixture.hostname) && fixture.pathname.startsWith('/aperture_test'))
  process.env.DATABASE_URL = fixture.toString()
  const migrations = await runMigrations(fixture.toString(), new URL('../../../../db/migrations/', import.meta.url).pathname)
  assert.equal(migrations.error, undefined)
  const scratch = await fs.mkdtemp(join(tmpdir(), 'aperture-backup-test-'))
  const originalPath = process.env.PATH
  const current = await queryOne<{ backup_path: string }>('SELECT backup_path FROM backup_config WHERE id=1')
  try {
    await fs.writeFile(join(scratch, 'pg_dump'), '#!/bin/sh\nprintf PGDMP\nexit 1\n', { mode: 0o700 })
    await fs.writeFile(join(scratch, 'candidate.sql'), 'UPDATE audit_restore_sentinel SET value=99;')
    process.env.PATH = scratch + ':' + originalPath
    await query('INSERT INTO backup_config (id,backup_path,retention_count) VALUES (1,$1,7) ON CONFLICT (id) DO UPDATE SET backup_path=EXCLUDED.backup_path', [scratch])
    await query('CREATE TABLE audit_restore_sentinel(value int); INSERT INTO audit_restore_sentinel VALUES (1);')
    const result = await restoreBackup('candidate.sql', true)
    assert.equal(result.success, false)
    assert.match(result.error ?? '', /safety backup failed.*pg_dump exited with 1/)
    assert.equal((await queryOne<{ value: number }>('SELECT value FROM audit_restore_sentinel'))?.value, 1)
    assert.deepEqual((await fs.readdir(scratch)).sort(), ['candidate.sql', 'pg_dump'])
  } finally {
    process.env.PATH = originalPath
    await query('DROP TABLE IF EXISTS audit_restore_sentinel')
    if (current) await query('UPDATE backup_config SET backup_path=$1 WHERE id=1', [current.backup_path])
    else await query('DELETE FROM backup_config WHERE id=1')
    await closePool()
    await fs.rm(scratch, { recursive: true, force: true })
  }
})
