import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

const database = process.env.ENCORE_TEST_DATABASE_URL

test('real authenticated REST writes validate complete inputs and retain valid partial updates', { skip: !database, timeout: 30000 }, async () => {
  process.env.DATABASE_URL = database!
  process.env.NODE_ENV = 'production'
  process.env.APP_BASE_URL = 'http://schema-rest.test'
  process.env.SESSION_SECRET = 'schema-rest-fixture-not-a-production-secret'
  const { getPool, closePool, runMigrations, createApiKey } = await import('@aperture/core')
  assert.equal((await runMigrations(database!, new URL('../../../../db/migrations/', import.meta.url).pathname)).error, undefined)
  const pool = getPool(), userId = randomUUID()
  const previous = (await pool.query<{ value: string; description: string | null }>("SELECT value,description FROM system_settings WHERE key='ai_config'")).rows[0]
  await pool.query("INSERT INTO users(id,provider,provider_user_id,username,is_admin,is_enabled) VALUES($1,'emby',$2,'Schema fixture',true,true)", [userId, randomUUID()])
  const { plaintextKey } = await createApiKey(userId, 'Disposable REST schema fixture', 1)
  const headers = { 'x-api-key': plaintextKey }
  const { buildServer } = await import('../server.js')
  const app = await buildServer({ logger: false, schemaAudit: true })
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => { networkCalls++; throw new Error('REST schema fixtures must not call external services') }
  try {
    await pool.query("INSERT INTO system_settings(key,value) VALUES('ai_config',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify({ embeddings: null, chat: null, textGeneration: null, exploration: null })])
    const settings = { provider: 'openai', model: 'gpt-4.1-mini', apiKey: 'fixture-not-a-real-key', baseUrl: 'http://127.0.0.1:1/v1' }
    const save = await app.inject({ method: 'PUT', url: '/api/settings/ai', headers, payload: { chat: settings, embeddings: null } })
    assert.equal(save.statusCode, 200, save.body)
    assert.deepEqual(JSON.parse((await pool.query("SELECT value FROM system_settings WHERE key='ai_config'")).rows[0].value).chat, settings)
    const invalidProvider = await app.inject({ method: 'PATCH', url: '/api/settings/ai/chat', headers, payload: { ...settings, provider: 'fixture-secret-submitted-value' } })
    assert.equal(invalidProvider.statusCode, 400)
    assert.doesNotMatch(invalidProvider.body, /fixture-not-a-real-key|fixture-secret-submitted-value/)
    assert.match(invalidProvider.json().error, /provider.*supported value/)
    assert.equal((await app.inject({ method: 'POST', url: '/api/settings/ai/test', headers, payload: { ...settings, function: 'chat', model: '' } })).statusCode, 400)
    assert.equal((await app.inject({ method: 'PUT', url: `/api/users/${userId}`, headers, payload: { displayName: 'Updated name' } })).statusCode, 200)
    assert.equal((await app.inject({ method: 'PUT', url: `/api/users/${userId}`, headers, payload: { displayName: false } })).statusCode, 400)
    assert.equal((await pool.query('SELECT display_name FROM users WHERE id=$1', [userId])).rows[0].display_name, 'Updated name')

    const conversation = await app.inject({ method: 'POST', url: '/api/assistant/conversations', headers, payload: { title: '  Film night  ' } })
    assert.equal(conversation.statusCode, 201)
    assert.equal(conversation.json().conversation.title, 'Film night')
    assert.equal((await app.inject({ method: 'PATCH', url: `/api/assistant/conversations/${conversation.json().conversation.id}`, headers, payload: { title: '' } })).statusCode, 400)
    const channel = await app.inject({ method: 'POST', url: '/api/channels', headers, payload: { name: 'Fixture shelf', genreFilters: ['Drama'] } })
    assert.equal(channel.statusCode, 201, channel.body)
    const channelId = channel.json().channel.id
    assert.equal((await app.inject({ method: 'PUT', url: `/api/channels/${channelId}`, headers, payload: { isActive: false } })).statusCode, 200)
    assert.equal((await pool.query('SELECT is_active FROM channels WHERE id=$1', [channelId])).rows[0].is_active, false)

    const franchise = `Schema-${randomUUID()}`
    // A bad later item must be rejected before the first item can be persisted.
    assert.equal((await app.inject({ method: 'PUT', url: '/api/settings/taste-profile/franchises', headers, payload: { franchises: [
      { franchiseName: franchise, mediaType: 'movie', preferenceScore: 1 },
      { franchiseName: 'Invalid later item', mediaType: 'movie', preferenceScore: 5 },
    ] } })).statusCode, 400)
    assert.equal((await pool.query('SELECT count(*) FROM user_franchise_preferences WHERE user_id=$1', [userId])).rows[0].count, '0')
    assert.equal((await app.inject({ method: 'PUT', url: '/api/settings/taste-profile/franchises', headers, payload: { franchises: [{ franchiseName: franchise, mediaType: 'movie', preferenceScore: 1 }] } })).statusCode, 200)
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/settings/taste-profile/franchises/${encodeURIComponent(franchise)}?mediaType=movie`, headers })).statusCode, 200)
    assert.equal((await pool.query('SELECT count(*) FROM user_franchise_preferences WHERE user_id=$1', [userId])).rows[0].count, '0')
    assert.equal((await app.inject({ method: 'PUT', url: '/api/settings/taste-profile/genres', headers, payload: { genres: [{ genre: 'Drama', weight: 1.5 }] } })).statusCode, 200)
    assert.equal((await app.inject({ method: 'DELETE', url: '/api/settings/taste-profile/genres/Drama', headers })).statusCode, 200)
    const workbench = await app.inject({ method: 'POST', url: '/api/assistant/workbench/deleteWatchPlan', headers, payload: { id: 'not-a-uuid' } })
    assert.equal(workbench.statusCode, 400)
    assert.equal(workbench.json().error, 'Invalid tool arguments')
    assert.equal(networkCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    await app.close()
    await pool.query('DELETE FROM users WHERE id=$1', [userId])
    if (previous) await pool.query("UPDATE system_settings SET value=$1,description=$2 WHERE key='ai_config'", [previous.value, previous.description])
    else await pool.query("DELETE FROM system_settings WHERE key='ai_config'")
    await closePool()
  }
})
