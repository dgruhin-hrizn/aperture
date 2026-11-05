import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { MockEmbeddingModelV3 } from 'ai/test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { closePool, getPool, runMigrations, getActiveEmbeddingTableName, getCurrentEmbeddingDimensions } from '@aperture/core'
import { createEncoreConnection, hashEncoreToken, createEncoreContext, createEncoreTools, ENCORE_SCOPES } from '@aperture/core/encore'
import { registerMcpHandler } from './mcp/http.js'
import { registerConnectionHandlers } from './handlers/connections.js'

const database = process.env.ENCORE_TEST_DATABASE_URL

test('real PostgreSQL and MCP HTTP enforce per-user catalogs, scopes, expiry and revocation', { skip: !database }, async () => {
  process.env.DATABASE_URL = database!
  const migrations = await runMigrations(database!, new URL('../../../../../db/migrations/', import.meta.url).pathname)
  assert.equal(migrations.error, undefined)
  const pool = getPool(), originalFetch = globalThis.fetch
  const prefix = randomUUID(), a = randomUUID(), b = randomUUID()
  const movieA = `${prefix}-a`, movieB = `${prefix}-b`
  const movieC = `${prefix}-c`
  const housemaid = `${prefix}-housemaid`, overviewMatch = `${prefix}-overview`, series = `${prefix}-series`
  let visibleExtra = false
  let visibleSearchFixtures = false
  const accountA = `${prefix}-alice`, accountB = `${prefix}-bob`
  await pool.query("INSERT INTO users(id, provider, provider_user_id, provider_access_token, username, is_enabled) VALUES ($1,'emby',$2,'token-a','Alice',true),($3,'emby',$4,'token-b','Bob',true)", [a, accountA, b, accountB])
  await pool.query("INSERT INTO movies(provider_item_id,title,genres,runtime_minutes,community_rating) VALUES ($1,'1917',ARRAY['Drama'],119,8.2),($2,'Private fixture film',ARRAY['Comedy'],85,9.0)", [movieA, movieB])
  for (const [key, value] of [['media_server_type', 'emby'], ['media_server_base_url', 'http://encore-emby.test'], ['media_server_api_key', 'fixture-admin']]) await pool.query('INSERT INTO system_settings(key,value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, value])
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    if (url.origin !== 'http://encore-emby.test') return originalFetch(input, init)
    const isA = url.pathname.includes(accountA)
    assert.ok(isA || url.pathname.includes(accountB), url.pathname)
    assert.equal(new Headers(init?.headers).get('X-Emby-Token'), isA ? 'token-a' : 'token-b')
    const items = [
      { Id: isA ? movieA : movieB, Type: 'Movie' },
      ...(isA && visibleExtra ? [{ Id: movieC, Type: 'Movie' }] : []),
      ...(isA && visibleSearchFixtures
        ? [{ Id: housemaid, Type: 'Movie' }, { Id: overviewMatch, Type: 'Movie' }, { Id: series, Type: 'Series' }]
        : []),
    ]
    return Response.json({ Items: items, TotalRecordCount: items.length })
  }
  const server = Fastify()
  server.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/assistant/connections')) request.user = { id: request.headers['x-fixture-other'] ? b : a, username: 'fixture', displayName: null, provider: 'emby', providerUserId: '', isAdmin: false, isEnabled: true, canManageWatchHistory: false, avatarUrl: null }
  })
  registerMcpHandler(server); registerConnectionHandlers(server)
  const url = await server.listen({ port: 0, host: '127.0.0.1' })
  const { token, connection } = await createEncoreConnection(a, 'Fixture client', ['library:read', 'profile:read'], 1)
  const client = new Client({ name: 'encore-integration-test', version: '1' })
  try {
    // A full-permission client must be able to discover every tool, including playlist writes.
    const full = await createEncoreConnection(a, 'Full schema fixture', [...ENCORE_SCOPES], 1)
    const fullClient = new Client({ name: 'full-schema-test', version: '1' })
    try {
      await fullClient.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${full.token}` } } }))
      const fullListing = await fullClient.listTools()
      assert.equal(fullListing.tools.length, 44)
      for (const tool of fullListing.tools) assert.equal(tool.inputSchema.type, 'object', tool.name)
      assert.ok(fullListing.tools.some(tool => tool.name === 'proposePlaylist'))
      const invalidPlaylist = await fullClient.callTool({ name: 'proposePlaylist', arguments: { operation: 'create', items: [{ id: randomUUID(), type: 'movie' }] } })
      assert.equal(invalidPlaylist.isError,true)
      assert.match(JSON.stringify(invalidPlaylist.content),/Invalid tool arguments/)
    } finally { await fullClient.close() }
    const bridge = new Client({ name: 'bridge-test', version: '1' })
    try {
      await bridge.connect(new StdioClientTransport({ command: process.execPath,
        args: [new URL('../../../../../packages/mcp/dist/aperture-mcp.mjs', import.meta.url).pathname],
        env: { APERTURE_URL: url, APERTURE_MCP_TOKEN: token } }))
      assert.ok((await bridge.listTools()).tools.some((tool) => tool.name === 'searchContent'))
      assert.match(JSON.stringify(await bridge.callTool({ name: 'searchContent', arguments: { query: '1917', type: 'movies' } })), /1917/)
    } finally { await bridge.close() }
    const raw = await pool.query('SELECT token_hash FROM encore_mcp_connections WHERE id = $1', [connection.id])
    assert.equal(raw.rows[0].token_hash, hashEncoreToken(token))
    assert.notEqual(raw.rows[0].token_hash, token)
    assert.equal((await server.inject({ method: 'POST', url: '/mcp', payload: {} })).statusCode, 401)
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
    const listing = await client.listTools()
    assert.ok(listing.tools.some((t) => t.name === 'searchContent'))
    assert.ok(!listing.tools.some((t) => t.name === 'getReleaseSchedule'))
    const found = await client.callTool({ name: 'searchContent', arguments: { query: '1917', type: 'movies' } })
    assert.equal(found.isError, undefined)
    assert.match(JSON.stringify(found), /1917/)
    const privateResult = await client.callTool({ name: 'searchContent', arguments: { query: 'Private fixture film', type: 'movies' } })
    assert.doesNotMatch(JSON.stringify(privateResult), /Private fixture film/)
    const stats = await client.callTool({ name: 'getLibraryStats', arguments: {} })
    assert.equal((stats.structuredContent as Record<string, unknown>)?.movieCount, 1)
    // Exercise real halfvec ranking and hard constraints, not a mocked SQL implementation.
    await pool.query("INSERT INTO movies(provider_item_id,title,genres,runtime_minutes,community_rating) VALUES ($1,'Quiet Signal',ARRAY['Drama'],80,5.5)", [movieC])
    visibleExtra = true
    await pool.query("INSERT INTO system_settings(key,value) VALUES ('ai_config',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify({embeddings:{provider:'openai', model:'text-embedding-3-large', apiKey:'fixture-key', baseUrl:'http://127.0.0.1:1/v1'}, chat:null, textGeneration:null, exploration:null})])
    const dimensions = await getCurrentEmbeddingDimensions()
    assert.ok(typeof dimensions === 'number' && dimensions > 0)
    const table = await getActiveEmbeddingTableName('embeddings')
    const q = [1, ...Array(dimensions - 1).fill(0)]
    const lessRelevant = [0.8, 0.6, ...Array(dimensions - 2).fill(0)]
    const rows = await pool.query('SELECT id, provider_item_id FROM movies WHERE provider_item_id = ANY($1)', [[movieA, movieB, movieC]])
    for (const row of rows.rows) await pool.query(`INSERT INTO ${table}(movie_id, model, embedding) VALUES ($1, 'fixture:similarity', $2::halfvec)`, [row.id, JSON.stringify(row.provider_item_id === movieA ? lessRelevant : q)])
    const context = await createEncoreContext(a)
    context.embeddingModel = new MockEmbeddingModelV3({ doEmbed: async () => ({ embeddings: [q], warnings: [] }) })
    context.embeddingModelId = 'fixture:similarity'
    const semantic = createEncoreTools(context).semanticSearch.execute!
    const options = { toolCallId: 'vector-fixture', messages: [], context: undefined }
    const ranked = await semantic({ concept: 'quiet drama', type: 'movies', excludeWatched: false } as never, options) as { items: Array<{name: string}> }
    assert.deepEqual(ranked.items.map((i) => i.name), ['Quiet Signal', '1917'])
    const constrained = await semantic({ concept: 'quiet drama', type: 'movies', maxRuntime: 90, genre: 'Drama', excludeWatched: false } as never, options) as { items: Array<{name: string}> }
    assert.deepEqual(constrained.items.map((i) => i.name), ['Quiet Signal'])

    // Named lookups work without embeddings and rank titles ahead of higher-rated synopsis matches.
    await pool.query(`
      INSERT INTO movies(provider_item_id, title, year, community_rating, overview)
      VALUES ($1, 'The Housemaid', 2025, 7.0, NULL),
             ($2, 'A Different Story', 2025, 9.0, 'A housemaid uncovers a secret.')
    `, [housemaid, overviewMatch])
    await pool.query("INSERT INTO series(provider_item_id, title, original_title) VALUES ($1, 'The Hidden Hour', 'Severance')", [series])
    await pool.query("UPDATE movies SET title = 'Housemaidsv' WHERE provider_item_id = $1", [movieB])
    visibleSearchFixtures = true
    const search = async (args: Record<string, unknown>) => {
      const result = await client.callTool({ name: 'searchContent', arguments: args })
      assert.equal(result.isError, undefined, JSON.stringify(result))
      return (result.structuredContent as { items: { name: string }[] }).items.map(({ name }) => name)
    }
    assert.deepEqual(await search({ query: 'The Housemaid', limit: 1 }), ['The Housemaid'])
    assert.deepEqual(await search({ query: ' housemaid ', type: 'movies' }), ['The Housemaid', 'A Different Story'])
    assert.deepEqual(await search({ query: 'housemaids' }), ['The Housemaid'])
    assert.deepEqual(await search({ query: 'housemaidsv' }), ['The Housemaid'])
    assert.deepEqual(await search({ query: 'Severence', type: 'series' }), ['The Hidden Hour'])
    assert.deepEqual(await search({ query: 'Housemaids', year: 1960 }), [])
    assert.deepEqual(await search({ query: '%' }), [])
    assert.deepEqual(await search({ genre: 'Drama', type: 'movies', limit: 1 }), ['1917'])

    assert.equal((await server.inject({ method: 'DELETE', url: `/api/assistant/connections/${connection.id}`, headers: { 'x-fixture-other': 'true' } })).statusCode, 404)
    assert.equal((await server.inject({ method: 'DELETE', url: `/api/assistant/connections/${connection.id}` })).statusCode, 204)
    await assert.rejects(client.listTools())
    const expired = await createEncoreConnection(a, 'Expired fixture', ['library:read'], 1)
    await pool.query("UPDATE encore_mcp_connections SET expires_at = now() - interval '1 second' WHERE id = $1", [expired.connection.id])
    assert.equal((await server.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${expired.token}` }, payload: {} })).statusCode, 401)
  } finally {
    await client.close(); await server.close(); globalThis.fetch = originalFetch
    await pool.query("DELETE FROM system_settings WHERE key = 'ai_config'")
    await pool.query('DELETE FROM movies WHERE provider_item_id = ANY($1)', [[movieA, movieB, movieC, housemaid, overviewMatch]])
    await pool.query('DELETE FROM series WHERE provider_item_id = $1', [series])
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[a, b]])
    await closePool()
  }
})
