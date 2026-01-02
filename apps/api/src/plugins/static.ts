import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs'

const staticPlugin: FastifyPluginAsync = async (fastify) => {
  // Only serve static files in production
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  // Path to web dist folder (relative to apps/api)
  const webDistPath = path.resolve(process.cwd(), '../web/dist')

  // Check if dist folder exists
  if (!fs.existsSync(webDistPath)) {
    fastify.log.warn({ path: webDistPath }, 'Web dist folder not found, skipping static file serving')
    return
  }

  // Register static file serving
  await fastify.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/',
    decorateReply: false,
  })

  // SPA fallback - serve index.html for non-API routes
  fastify.setNotFoundHandler(async (request, reply) => {
    // Don't intercept API routes
    if (request.url.startsWith('/api') || request.url.startsWith('/health')) {
      return reply.status(404).send({ error: 'Not Found' })
    }

    // Serve index.html for SPA routing
    const indexPath = path.join(webDistPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      return reply.sendFile('index.html')
    }

    return reply.status(404).send({ error: 'Not Found' })
  })
}

export default fp(staticPlugin, {
  name: 'static',
  dependencies: ['@fastify/cookie'],
})

