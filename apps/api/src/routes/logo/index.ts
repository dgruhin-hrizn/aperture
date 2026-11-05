import type { FastifyPluginAsync } from 'fastify'
import { apertureLogoSvg } from '../../config/openapi.js'

const logoRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/logo.svg
   * Serve the Aperture logo for Swagger UI and other uses
   */
  fastify.get('/api/logo.svg', async (_request, reply) => {
    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('Cache-Control', 'public, max-age=3600')
      .send(apertureLogoSvg)
  })
}

export default logoRoutes
