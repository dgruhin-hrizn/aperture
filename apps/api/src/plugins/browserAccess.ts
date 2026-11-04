import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { TLSSocket } from 'node:tls'
import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'

interface BrowserAccessOptions {
  appBaseUrl?: string
  production?: boolean
  sessionSecret?: string
}
export interface BrowserAccessPolicy {
  canonicalOrigin: string | null
  secureCanonicalHostname: string | null
  developmentOrigins: ReadonlySet<string>
}
declare module 'fastify' {
  interface FastifyInstance {
    browserAccessPolicy?: BrowserAccessPolicy
  }
}
function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}
function browserOrigin(value: string): string | null {
  const url = httpUrl(value)
  // Origin is a serialized HTTP(S) origin, not a URL containing a path or credentials.
  return url && (value === url.origin || value === `${url.origin}/`) ? url.origin : null
}
function destination(request: FastifyRequest): URL | null {
  const host = request.headers.host
  if (!host || /[\s/@?#\\]/.test(host)) return null
  const scheme = (request.raw.socket as TLSSocket).encrypted === true ? 'https:' : 'http:'
  return httpUrl(`${scheme}//${host}`)
}
export function createBrowserAccessPolicy(options: BrowserAccessOptions = {}): BrowserAccessPolicy {
  const base = options.appBaseUrl ? httpUrl(options.appBaseUrl) : null
  return {
    canonicalOrigin: base?.origin ?? null,
    secureCanonicalHostname: base?.protocol === 'https:' ? base.hostname : null,
    developmentOrigins: new Set(
      options.production
        ? []
        : [
            'http://localhost:3456',
            'http://localhost:3457',
            'http://127.0.0.1:3456',
            'http://127.0.0.1:3457',
          ]
    ),
  }
}
export function isAllowedBrowserOrigin(
  request: FastifyRequest,
  policy: BrowserAccessPolicy
): boolean {
  const value = request.headers.origin
  if (value === undefined) return true // Non-browser clients and ordinary navigations.
  const origin = browserOrigin(value)
  return Boolean(
    origin &&
    (origin === policy.canonicalOrigin ||
      origin === destination(request)?.origin ||
      policy.developmentOrigins.has(origin))
  )
}
/** Protect HTTPS cookies while allowing a separate session on a direct HTTP LAN host. */
export function sessionCookieOptions(request: FastifyRequest) {
  const policy =
    request.server.browserAccessPolicy ??
    createBrowserAccessPolicy({
      appBaseUrl: process.env.APP_BASE_URL,
      production: process.env.NODE_ENV === 'production',
    })
  const origin = request.headers.origin ? browserOrigin(request.headers.origin) : null
  const canonicalHttpsOrigin = policy.secureCanonicalHostname ? policy.canonicalOrigin : null
  const secure =
    (request.raw.socket as TLSSocket).encrypted === true ||
    destination(request)?.hostname === policy.secureCanonicalHostname ||
    Boolean(canonicalHttpsOrigin && origin === canonicalHttpsOrigin) ||
    // This hint may only ADD Secure. Never trust forwarded HTTP to downgrade it,
    // and never trust forwarded host/IP headers for the CORS decision.
    request.headers['x-forwarded-proto'] === 'https'
  return { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' }
}
const browserAccessPlugin: FastifyPluginAsync<BrowserAccessOptions> = async (fastify, options) => {
  const policy = createBrowserAccessPolicy(options)
  fastify.decorate('browserAccessPolicy', policy)
  await fastify.register(cors, {
    delegator(request, callback) {
      if (!isAllowedBrowserOrigin(request, policy)) {
        request.log.warn(
          {
            origin: request.headers.origin,
            host: request.headers.host,
            canonicalOrigin: policy.canonicalOrigin,
          },
          'CORS request rejected - origin not allowed'
        )
        const error = Object.assign(new Error('Origin not allowed'), {
          statusCode: 403,
          code: 'CORS_ORIGIN_DENIED',
        })
        callback(error)
        return
      }
      callback(null, { origin: true, credentials: true })
    },
  })
  await fastify.register(cookie, {
    secret: options.sessionSecret || 'development-secret-change-me',
    parseOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
  })
}
export default fp(browserAccessPlugin, { name: 'browser-access' })
