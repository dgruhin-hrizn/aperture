import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import browserAccessPlugin from './browserAccess.js'
import { clearSessionCookie, setSessionCookie } from './auth.js'

async function app(production = true) {
  const server = Fastify()
  let mutations = 0
  await server.register(browserAccessPlugin, {
    appBaseUrl: 'https://aperture.example/',
    production,
    sessionSecret: 'test-secret-that-is-at-least-32-characters',
  })
  server.get('/assets/app.js', async () => 'export default true')
  server.post('/mutation', async () => ({ mutations: ++mutations }))
  server.post('/session', async (_request, reply) => {
    setSessionCookie(reply, 'fixture-session')
    return { success: true }
  })
  server.delete('/session', async (_request, reply) => {
    clearSessionCookie(reply)
    return { success: true }
  })
  return { server, mutations: () => mutations }
}

test('production allows its exact LAN origin and canonical proxy origin, including asset requests', async () => {
  const { server } = await app()
  try {
    for (const [host, origin] of [
      ['192.168.1.8:3456', 'http://192.168.1.8:3456'],
      ['unraid.local:3456', 'http://unraid.local:3456'],
      ['[fd00::8]:3456', 'http://[fd00::8]:3456'],
      ['127.0.0.1:3456', 'http://127.0.0.1:3456'],
      ['aperture.example', 'https://aperture.example'],
      ['192.168.1.8:3456', 'https://aperture.example'],
    ]) {
      const response = await server.inject({ url: '/assets/app.js', headers: { host, origin } })
      assert.equal(response.statusCode, 200, response.body)
      assert.equal(response.headers['access-control-allow-origin'], origin)
      assert.equal(response.headers['access-control-allow-credentials'], 'true')
      assert.match(String(response.headers.vary), /Origin/i)
    }
    assert.equal((await server.inject('/assets/app.js')).statusCode, 200)
  } finally {
    await server.close()
  }
})

test('other origins and spoofed forwarding headers return 403 before mutations execute', async () => {
  const { server, mutations } = await app()
  try {
    for (const origin of [
      'https://evil.example',
      'https://aperture.example.evil.example',
      'http://192.168.1.9:3456',
      'http://192.168.1.8:3457',
      'http://localhost:3457',
      'null',
      'file://local',
      'https://user:password@aperture.example',
      'https://aperture.example/path',
      'https://aperture.example https://evil.example',
    ]) {
      const response = await server.inject({
        method: 'POST',
        url: '/mutation',
        headers: {
          host: '192.168.1.8:3456',
          origin,
          'x-forwarded-host': 'evil.example',
          'x-forwarded-proto': 'https',
          'x-forwarded-for': '127.0.0.1',
        },
      })
      assert.equal(response.statusCode, 403, origin)
      assert.equal(response.json().code, 'CORS_ORIGIN_DENIED')
      assert.equal(response.headers['access-control-allow-origin'], undefined)
    }
    assert.equal(mutations(), 0)
  } finally {
    await server.close()
  }
})

test('preflight validates origin and development loopback exceptions stay development-only', async () => {
  for (const production of [true, false]) {
    const { server } = await app(production)
    try {
      const headers = {
        host: '192.168.1.8:3456',
        origin: 'http://192.168.1.8:3456',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      }
      const accepted = await server.inject({ method: 'OPTIONS', url: '/mutation', headers })
      assert.equal(accepted.statusCode, 204)
      assert.match(String(accepted.headers['access-control-allow-methods']), /POST/)
      assert.equal(accepted.headers['access-control-allow-headers'], 'content-type')
      assert.equal(
        (
          await server.inject({
            method: 'OPTIONS',
            url: '/mutation',
            headers: { ...headers, origin: 'https://evil.example' },
          })
        ).statusCode,
        403
      )
      assert.equal(
        (
          await server.inject({
            url: '/assets/app.js',
            headers: { host: '192.168.1.8:3456', origin: 'http://localhost:3457' },
          })
        ).statusCode,
        production ? 403 : 200
      )
    } finally {
      await server.close()
    }
  }
})

test('session creation and clearing use host-only HTTP LAN or Secure proxy cookies', async () => {
  const { server } = await app()
  try {
    for (const [host, origin, forwarded, secure] of [
      ['192.168.1.8:3456', 'http://192.168.1.8:3456', undefined, false],
      ['192.168.1.8:3456', 'http://192.168.1.8:3456', 'http', false],
      ['192.168.1.8:3456', 'http://192.168.1.8:3456', 'https', true],
      ['192.168.1.8:3456', 'https://aperture.example', undefined, true],
      ['aperture.example', undefined, undefined, true],
      ['aperture.example', undefined, 'http', true],
      // Cookies do not isolate ports: HTTP on the public hostname must not overwrite its Secure cookie.
      ['aperture.example:3456', 'http://aperture.example:3456', 'http', true],
      ['192.168.1.8:3456', undefined, undefined, false],
    ] as const) {
      const headers: Record<string, string> = { host }
      if (origin) headers.origin = origin
      if (forwarded) headers['x-forwarded-proto'] = forwarded
      for (const method of ['POST', 'DELETE'] as const) {
        const response = await server.inject({ method, url: '/session', headers })
        assert.equal(response.statusCode, 200, response.body)
        const cookie = String(response.headers['set-cookie'])
        assert.equal(/; Secure(?:;|$)/.test(cookie), secure, cookie)
        assert.match(cookie, /; HttpOnly/)
        assert.match(cookie, /; SameSite=Lax/)
        assert.match(cookie, /; Path=\//)
        assert.doesNotMatch(cookie, /; Domain=/)
        if (method === 'POST') assert.match(cookie, /; Max-Age=2592000/)
        else assert.match(cookie, /; Max-Age=0/)
      }
    }
  } finally {
    await server.close()
  }
})
