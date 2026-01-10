import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { createLogger } from './lib/logger.js'
import requestIdPlugin from './plugins/requestId.js'
import authPlugin from './plugins/auth.js'
import staticPlugin from './plugins/static.js'
import routes from './routes/index.js'

export interface ServerOptions {
  logger?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildServer(options: ServerOptions = {}): Promise<any> {
  const logger = createLogger('api')

  const fastify = Fastify({
    loggerInstance: options.logger !== false ? logger : undefined,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  })

  // Register CORS
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true)
        return
      }

      // In development, allow localhost origins and configured external domains
      if (process.env.NODE_ENV !== 'production') {
        const allowedOrigins = [
          'http://localhost:3456',
          'http://localhost:3457',
          'http://127.0.0.1:3456',
          'http://127.0.0.1:3457',
        ]
        // Also allow APP_BASE_URL in development for external access
        const appBaseUrl = process.env.APP_BASE_URL
        if (appBaseUrl) {
          allowedOrigins.push(appBaseUrl)
        }
        if (allowedOrigins.includes(origin)) {
          cb(null, true)
          return
        }
      }

      // In production, check against APP_BASE_URL
      const appBaseUrl = process.env.APP_BASE_URL
      if (appBaseUrl && origin === appBaseUrl) {
        cb(null, true)
        return
      }

      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
  })

  // Register cookie support
  // Only use secure cookies if APP_BASE_URL is HTTPS
  const appBaseUrl = process.env.APP_BASE_URL || ''
  const useSecureCookies = appBaseUrl.startsWith('https://')
  
  await fastify.register(cookie, {
    secret: process.env.SESSION_SECRET || 'development-secret-change-me',
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: useSecureCookies,
      path: '/',
    },
  })

  // Register request ID plugin
  await fastify.register(requestIdPlugin)

  // Register auth plugin
  await fastify.register(authPlugin)

  // Register routes
  await fastify.register(routes)

  // Register static file serving (production only)
  await fastify.register(staticPlugin)

  return fastify
}
