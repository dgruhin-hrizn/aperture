import type { FastifyPluginAsync } from 'fastify'
import {
  scanMissingPosters,
  repairPostersAsync,
  type MissingPosterItem,
} from '@aperture/core'
import { requireAdmin } from '../../plugins/auth.js'
import { randomUUID } from 'crypto'
import { maintenanceSchemas } from './schemas.js'

const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(maintenanceSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  // =========================================================================
  // Poster Repair
  // =========================================================================

  /**
   * POST /api/maintenance/posters/scan
   * Scan Emby for items with missing poster images
   */
  fastify.post(
    '/api/maintenance/posters/scan',
    { preHandler: requireAdmin, schema: { tags: ["admin"] } },
    async (_request, reply) => {
      try {
        fastify.log.info('Starting scan for missing posters')
        const result = await scanMissingPosters()
        
        return reply.send({
          success: true,
          movies: result.movies,
          series: result.series,
          totalMissing: result.totalMissing,
          scannedAt: result.scannedAt,
          summary: {
            moviesWithMissingPosters: result.movies.length,
            seriesWithMissingPosters: result.series.length,
            moviesWithTmdbId: result.movies.filter(m => m.tmdbId).length,
            seriesWithTmdbId: result.series.filter(s => s.tmdbId).length,
            moviesRepairable: result.movies.filter(m => m.tmdbId).length,
            seriesRepairable: result.series.filter(s => s.tmdbId).length,
          }
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to scan for missing posters')
        return reply.status(500).send({ 
          error: err instanceof Error ? err.message : 'Failed to scan for missing posters' 
        })
      }
    }
  )

  /**
   * POST /api/maintenance/posters/repair
   * Repair selected items by fetching posters from TMDB and pushing to Emby
   * Returns immediately with a jobId for progress tracking
   */
  fastify.post<{
    Body: {
      items: MissingPosterItem[]
    }
  }>(
    '/api/maintenance/posters/repair',
    { preHandler: requireAdmin, schema: { tags: ["admin"] } },
    async (request, reply) => {
      try {
        const { items } = request.body

        if (!items || !Array.isArray(items) || items.length === 0) {
          return reply.status(400).send({ error: 'No items provided for repair' })
        }

        // Filter to only items with TMDB IDs
        const repairableItems = items.filter(item => item.tmdbId)
        
        if (repairableItems.length === 0) {
          return reply.status(400).send({ 
            error: 'No items with TMDB IDs available for repair' 
          })
        }

        const jobId = randomUUID()

        fastify.log.info(
          { total: items.length, repairable: repairableItems.length, jobId },
          'Starting async poster repair'
        )

        // Start repair in background (fire and forget)
        repairPostersAsync(repairableItems, jobId).catch((err) => {
          fastify.log.error({ err, jobId }, 'Background poster repair failed')
        })

        // Return immediately with jobId
        return reply.send({
          success: true,
          jobId,
          total: repairableItems.length,
          skippedNoTmdbId: items.length - repairableItems.length,
          message: 'Repair started. Track progress with /api/jobs/progress/:jobId',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to start poster repair')
        return reply.status(500).send({ 
          error: err instanceof Error ? err.message : 'Failed to start poster repair' 
        })
      }
    }
  )
}

export default maintenanceRoutes
