import assert from 'node:assert/strict'
import { Agent, createServer, get } from 'node:http'
import { test } from 'node:test'
import Fastify from 'fastify'
import { getPool, closePool } from '@aperture/core'
import mediaProxyRoutes from './index.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'

test('hung artwork releases browser connection slots, including stalled bodies, and preserves successful images', async () => {
  let closed = 0
  const upstream = createServer((request, response) => {
    if (request.url === '/good') {
      response.setHeader('Content-Type', 'image/jpeg')
      response.end(Buffer.from([255, 216, 255, 217]))
    } else if (request.url === '/missing') {
      response.writeHead(404).end('missing')
    } else {
      response.on('close', () => closed++)
      if (request.url === '/body') {
        response.writeHead(200, { 'Content-Type': 'image/jpeg' })
        response.write(Buffer.from([255, 216]))
      }
    }
  })
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const address = upstream.address()
  assert.ok(address && typeof address === 'object')
  const pool = getPool(),
    originalQuery = pool.query
  Object.assign(pool, {
    query: async (_sql: string, values: string[]) => ({
      rows: [
        {
          value: {
            media_server_type: 'emby',
            media_server_base_url: `http://127.0.0.1:${address.port}`,
            media_server_api_key: 'image-fixture-only',
          }[values[0]],
        },
      ],
      rowCount: 1,
    }),
  })
  const app = Fastify(),
    agent = new Agent({ keepAlive: true, maxSockets: 6 })
  await app.register(mediaProxyRoutes, { timeoutMs: 1000 })
  app.get('/catalog-read', async () => ({ people: [{ name: 'Loaded' }] }))
  const base = await app.listen({ port: 0, host: '127.0.0.1' })
  const read = (path: string) =>
    new Promise<{ status: number; body: Buffer }>((resolve, reject) => {
      get(`${base}${path}`, { agent }, (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({ status: response.statusCode!, body: Buffer.concat(chunks) })
        )
      }).on('error', reject)
    })
  try {
    const good = await read('/api/media/images/good')
    assert.equal(good.status, 200)
    assert.deepEqual(good.body, Buffer.from([255, 216, 255, 217]))
    assert.equal((await read('/api/media/images/missing')).status, 404)
    const start = Date.now()
    // All six HTTP/1.1 slots are occupied before the catalog request is queued.
    const queued = [
      ...Array.from({ length: 6 }, (_, i) =>
        read(`/api/media/images/${i % 2 ? 'body' : 'headers'}`)
      ),
      read('/catalog-read'),
    ]
    const results = await Promise.all(queued)
    assert.deepEqual(
      results.map((r) => r.status),
      [504, 504, 504, 504, 504, 504, 200]
    )
    assert.deepEqual(JSON.parse(results[6].body.toString()), { people: [{ name: 'Loaded' }] })
    assert.ok(
      Date.now() - start < 5000,
      'a queued catalog read is not blocked indefinitely behind artwork'
    )
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(closed, 6, 'both header and body stalls cancel their upstream connection')
  } finally {
    agent.destroy()
    await app.close()
    upstream.closeAllConnections()
    await new Promise<void>((resolve) => upstream.close(() => resolve()))
    pool.query = originalQuery
    await closePool()
  }
})
