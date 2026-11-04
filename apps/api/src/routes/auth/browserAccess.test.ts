import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { closePool, getPool } from '@aperture/core'
import browserAccessPlugin from '../../plugins/browserAccess.js'
import authPlugin from '../../plugins/auth.js'
import authRoutes from './index.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'

test('real auth routes support independent LAN/proxy sessions without writing settings or preferences', async () => {
  const pool = getPool()
  const originalQuery = pool.query
  const originalFetch = globalThis.fetch
  const user = {
    id: randomUUID(),
    username: 'Gru',
    display_name: 'Gru',
    provider: 'emby',
    provider_user_id: 'emby-gru',
    is_admin: true,
    is_enabled: true,
    can_manage_watch_history: true,
  }
  const sessions = new Map<string, { id: string; user_id: string; expires_at: Date }>()
  let upstreamCalls = 0,
    writes = 0
  const settings: Record<string, string> = {
    media_server_type: 'emby',
    media_server_base_url: 'http://emby.test',
    media_server_api_key: 'test-key',
    allow_passwordless_login: 'false',
  }
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      let rows: unknown[] = []
      if (sql.includes('FROM system_settings'))
        rows = [{ value: settings[String(params[0])] ?? null }]
      else if (sql.includes('FROM users')) rows = [user]
      else if (sql.includes('UPDATE users SET')) {
        // Normal login refreshes provider identity/token, never application preferences.
        assert.doesNotMatch(sql, /preferences|ui_language|ai_language|is_enabled\s*=/)
        assert.equal(params[4], user.id)
        writes++
        rows = [user]
      } else if (sql.includes('INSERT INTO sessions')) {
        const session = {
          id: randomUUID(),
          user_id: String(params[0]),
          expires_at: params[1] as Date,
        }
        sessions.set(session.id, session)
        writes++
        rows = [{ id: session.id }]
      } else if (sql.includes('SELECT id, user_id, expires_at FROM sessions'))
        rows = sessions.has(String(params[0])) ? [sessions.get(String(params[0]))] : []
      else if (sql.includes('DELETE FROM sessions WHERE id')) {
        sessions.delete(String(params[0]))
        writes++
      } else throw Error(`Unexpected query: ${sql}`)
      return { rows, rowCount: rows.length }
    },
  })
  globalThis.fetch = async (input, init) => {
    upstreamCalls++
    const url = new URL(String(input))
    assert.equal(url.origin, 'http://emby.test')
    const providerUser = {
      Id: 'emby-gru',
      Name: 'Gru',
      ServerId: 'test-server',
      Policy: { IsAdministrator: true, IsDisabled: false },
    }
    if (url.pathname === '/Users/AuthenticateByName') {
      const body = JSON.parse(String(init?.body))
      assert.equal(body.Username, 'Gru')
      if (body.Pw !== 'fixture-password') return Response.json({}, { status: 401 })
      return Response.json({ User: providerUser, AccessToken: 'fixture-provider-token' })
    }
    assert.equal(url.pathname, '/Users/emby-gru')
    return Response.json(providerUser)
  }
  const server = Fastify({ ajv: { customOptions: { keywords: ['example'] } } })
  try {
    await server.register(browserAccessPlugin, {
      production: true,
      appBaseUrl: 'https://aperture.example',
      sessionSecret: 'test-secret-that-is-at-least-32-characters',
    })
    await server.register(authPlugin)
    await server.register(authRoutes)
    const lan = { host: '192.168.1.8:3456', origin: 'http://192.168.1.8:3456' }
    const proxy = {
      host: '192.168.1.8:3456',
      origin: 'https://aperture.example',
      'x-forwarded-proto': 'https',
    }
    assert.equal((await server.inject({ url: '/api/auth/me', headers: lan })).statusCode, 401)
    const denied = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { ...lan, origin: 'https://evil.example' },
      payload: { username: 'Gru', password: 'fixture-password' },
    })
    assert.equal(denied.statusCode, 403)
    assert.equal(upstreamCalls, 0)
    assert.equal(writes, 0)
    const invalid = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: lan,
      payload: { username: 'Gru', password: 'wrong' },
    })
    assert.equal(invalid.statusCode, 401)
    assert.equal(sessions.size, 0)
    assert.equal(invalid.headers['set-cookie'], undefined)
    const cookies: string[] = []
    for (const headers of [proxy, lan]) {
      const login = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers,
        payload: { username: 'Gru', password: 'fixture-password' },
      })
      assert.equal(login.statusCode, 200, login.body)
      assert.equal(login.json().user.username, 'Gru')
      const cookie = String(login.headers['set-cookie'])
      assert.equal(/; Secure(?:;|$)/.test(cookie), headers === proxy)
      assert.doesNotMatch(cookie, /; Domain=/)
      cookies.push(cookie.split(';')[0])
      const check = await server.inject({
        url: '/api/auth/check',
        headers: { ...headers, cookie: cookies.at(-1)! },
      })
      assert.equal(check.json().authenticated, true)
      assert.equal(
        (
          await server.inject({
            url: '/api/auth/me',
            headers: { ...headers, cookie: cookies.at(-1)! },
          })
        ).json().user.id,
        user.id
      )
    }
    assert.equal(sessions.size, 2, 'LAN login must not replace the public session')
    const logout = await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { ...lan, cookie: cookies[1] },
    })
    assert.equal(logout.statusCode, 200)
    assert.match(String(logout.headers['set-cookie']), /Max-Age=0/)
    assert.doesNotMatch(String(logout.headers['set-cookie']), /; Secure/)
    assert.equal(
      (
        await server.inject({ url: '/api/auth/check', headers: { ...lan, cookie: cookies[1] } })
      ).json().authenticated,
      false
    )
    assert.equal(
      (await server.inject({ url: '/api/auth/me', headers: { ...proxy, cookie: cookies[0] } }))
        .statusCode,
      200
    )
    const publicLogout = await server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { ...proxy, cookie: cookies[0] },
    })
    assert.match(String(publicLogout.headers['set-cookie']), /; Secure/)
    assert.equal(sessions.size, 0)
  } finally {
    await server.close()
    Object.assign(pool, { query: originalQuery })
    globalThis.fetch = originalFetch
    await closePool()
  }
})
