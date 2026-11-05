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
  const previousCredentials = (await pool.query<{ value: string; description: string | null }>("SELECT value,description FROM system_settings WHERE key='ai_provider_credentials'")).rows[0]
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

    const local = { provider: 'openai-compatible', baseUrl: 'http://omlx.test:8000', apiKey: 'fixture-local-key' }
    let toolProbes = 0
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      const auth = new Headers(init?.headers).get('authorization')
      if (url.href === 'https://api.openai.com/v1/models') {
        assert.equal(auth, 'Bearer fixture-cloud-key')
        return Response.json({ data: [
          { id: 'gpt-6.1-sol', created: 20 },
          { id: 'gpt-4.1-mini', created: 10 },
          { id: 'gpt-4o-realtime-preview', created: 30 },
          { id: 'gpt-5-mini', created: 40, shutdown_date: '2000-01-01' },
          { id: 'text-embedding-3-small', created: 5 },
        ] })
      }
      if (url.hostname === 'other-endpoint.test') {
        assert.equal(auth, null, 'A saved key must stay with its original endpoint')
        return Response.json({ data: [] })
      }
      assert.equal(url.origin, local.baseUrl)
      assert.equal(auth, 'Bearer fixture-local-key')
      if (url.pathname === '/v1/models') {
        return Response.json({ data: [
          { id: 'qwen-tools', model_type: 'llm' },
          { id: 'plain-text', model_type: 'llm', capabilities: { supportsToolCalling: false } },
          { id: 'bge', model_type: 'embedding' },
          { id: 'reranker', model_type: 'reranker' },
        ] })
      }
      assert.equal(url.pathname, '/v1/chat/completions')
      const body = JSON.parse(String(init?.body))
      assert.equal(body.stream, true)
      assert.equal(body.tools[0].function.name, 'aperture_test')
      toolProbes++
      const withTools = body.model === 'qwen-tools'
      const delta = withTools ? { tool_calls: [{
        index: 0, id: 'call_fixture', type: 'function',
        function: { name: 'aperture_test', arguments: '{"status":"ok"}' },
      }] } : { content: 'Plain text only' }
      return new Response([
        { id: 'fixture', choices: [{ index: 0, delta, finish_reason: null }] },
        { id: 'fixture', choices: [{ index: 0, delta: {}, finish_reason: withTools ? 'tool_calls' : 'stop' }] },
      ].map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      })
    }
    await app.inject({ method: 'PUT', url: '/api/settings/ai', headers, payload: {
      chat: { provider: 'openai', model: 'gpt-4.1-mini', apiKey: 'fixture-cloud-key', baseUrl: 'https://api.openai.com/v1' },
    } })
    const cloudModels = await app.inject({ url: '/api/settings/ai/models?provider=openai&function=chat', headers })
    assert.equal(cloudModels.statusCode, 200, cloudModels.body)
    assert.equal(cloudModels.json().source, 'live', cloudModels.body)
    assert.deepEqual(cloudModels.json().models.map((model: { id: string }) => model.id), ['gpt-6.1-sol', 'gpt-4.1-mini'])
    const cloudSave = await app.inject({ method: 'PATCH', url: '/api/settings/ai/chat', headers, payload: { provider: 'openai', model: 'gpt-6.1-sol' } })
    assert.equal(cloudSave.statusCode, 200, cloudSave.body)
    assert.equal(cloudSave.json().config.apiKey, 'fixture-cloud-key')
    const providers = await app.inject({ url: '/api/settings/ai/providers?function=chat', headers })
    assert.ok(providers.json().providers.some((provider: { id: string }) => provider.id === local.provider))

    const discover = (fn: string) => app.inject({ method: 'POST', url: '/api/settings/ai/models', headers, payload: { ...local, function: fn } })
    assert.deepEqual((await discover('chat')).json().models.map((model: { id: string }) => model.id), ['qwen-tools'])
    assert.deepEqual((await discover('embeddings')).json().models.map((model: { id: string }) => model.id), ['bge'])
    assert.equal((await app.inject({ method: 'POST', url: '/api/settings/ai/models', payload: { ...local, function: 'chat' } })).statusCode, 401)
    const probe = (model: string) => app.inject({ method: 'POST', url: '/api/settings/ai/test', headers, payload: { ...local, model, function: 'chat' } })
    assert.equal((await probe('plain-text')).json().success, false)
    const verified = await probe('qwen-tools')
    assert.equal(verified.json().success, true, verified.body)
    const localSave = await app.inject({ method: 'PATCH', url: '/api/settings/ai/chat', headers, payload: { ...local, model: 'qwen-tools' } })
    assert.equal(localSave.statusCode, 200, localSave.body)
    assert.equal(localSave.json().config.baseUrl, 'http://omlx.test:8000/v1')
    assert.equal(localSave.json().config.toolCallingVerified, true)
    assert.equal(toolProbes, 2)
    const alternate = await app.inject({ method: 'POST', url: '/api/settings/ai/models', headers, payload: {
      provider: local.provider, function: 'chat', baseUrl: 'http://other-endpoint.test',
    } })
    assert.equal(alternate.json().source, 'live', alternate.body)
  } finally {
    globalThis.fetch = originalFetch
    await app.close()
    await pool.query('DELETE FROM users WHERE id=$1', [userId])
    if (previous) await pool.query("UPDATE system_settings SET value=$1,description=$2 WHERE key='ai_config'", [previous.value, previous.description])
    else await pool.query("DELETE FROM system_settings WHERE key='ai_config'")
    if (previousCredentials) await pool.query("UPDATE system_settings SET value=$1,description=$2 WHERE key='ai_provider_credentials'", [previousCredentials.value, previousCredentials.description])
    else await pool.query("DELETE FROM system_settings WHERE key='ai_provider_credentials'")
    await closePool()
  }
})
