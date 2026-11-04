import Fastify from 'fastify'
import browserAccessPlugin from './plugins/browserAccess.js'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { createLogger } from './lib/logger.js'
import requestIdPlugin from './plugins/requestId.js'
import authPlugin from './plugins/auth.js'
import staticPlugin from './plugins/static.js'
import routes from './routes/index.js'
import { getSwaggerConfig, swaggerUIConfig } from './config/openapi.js'

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
    ajv: {
      customOptions: {
        // Allow OpenAPI 'example' keyword in schemas for documentation
        keywords: ['example'],
      },
    },
  })

  const appBaseUrl = process.env.APP_BASE_URL || ''
  await fastify.register(browserAccessPlugin, {
    appBaseUrl,
    production: process.env.NODE_ENV === 'production',
    sessionSecret: process.env.SESSION_SECRET,
  })

  // Register request ID plugin
  await fastify.register(requestIdPlugin)

  // Register Swagger/OpenAPI documentation
  await fastify.register(swagger, getSwaggerConfig(appBaseUrl))
  await fastify.register(swaggerUI, swaggerUIConfig)

  // Register auth plugin
  await fastify.register(authPlugin)

  // Register routes
  await fastify.register(routes)

  // Register static file serving (production only)
  await fastify.register(staticPlugin)

  return fastify
}
