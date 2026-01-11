import type { FastifyPluginAsync } from 'fastify'
import {
  scanMissingPosters,
  repairPosters,
  type MissingPosterItem,
} from '@aperture/core'
import { requireAdmin } from '../plugins/auth.js'

const maintenanceRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // Poster Repair
  // =========================================================================

  /**
   * POST /api/maintenance/posters/scan
   * Scan Emby for items with missing poster images
   */
  fastify.post(
    '/api/maintenance/posters/scan',
    { preHandler: requireAdmin },
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
   */
  fastify.post<{
    Body: {
      items: MissingPosterItem[]
    }
  }>(
    '/api/maintenance/posters/repair',
    { preHandler: requireAdmin },
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

        fastify.log.info(
          { total: items.length, repairable: repairableItems.length },
          'Starting poster repair'
        )

        const result = await repairPosters(repairableItems)

        return reply.send({
          success: true,
          total: result.total,
          completed: result.completed,
          successful: result.successful,
          failed: result.failed,
          results: result.results,
          summary: {
            repaired: result.successful,
            failed: result.failed,
            skippedNoTmdbId: items.length - repairableItems.length,
          }
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to repair posters')
        return reply.status(500).send({ 
          error: err instanceof Error ? err.message : 'Failed to repair posters' 
        })
      }
    }
  )
}

export default maintenanceRoutes

