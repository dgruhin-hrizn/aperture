/**
 * Jobs Progress Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getJobProgress,
  getAllJobProgress,
  subscribeToJob,
  createChildLogger,
  type JobProgress,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'

const logger = createChildLogger('jobs-progress')

export async function registerProgressHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs/progress/:jobId
   * Get detailed progress for a specific job run
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/api/jobs/progress/:jobId',
    { preHandler: requireAdmin, schema: jobSchemas.getJobProgress },
    async (request, reply) => {
      const { jobId } = request.params
      const progress = getJobProgress(jobId)

      if (!progress) {
        return reply.status(404).send({ error: 'Job not found or expired' })
      }

      return reply.send(progress)
    }
  )

  /**
   * GET /api/jobs/progress/stream/:jobId
   * Server-Sent Events stream for real-time job progress
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/api/jobs/progress/stream/:jobId',
    { preHandler: requireAdmin, schema: jobSchemas.streamJobProgress },
    async (request, reply) => {
      const { jobId } = request.params

      // Track if connection is still open
      let isConnectionOpen = true

      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      // Safe write function that checks connection state
      const safeWrite = (data: string): boolean => {
        if (!isConnectionOpen) return false
        try {
          reply.raw.write(data)
          return true
        } catch {
          isConnectionOpen = false
          return false
        }
      }

      // Send initial progress
      const initialProgress = getJobProgress(jobId)
      if (initialProgress) {
        safeWrite(`data: ${JSON.stringify(initialProgress)}\n\n`)
      }

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        if (!safeWrite(': heartbeat\n\n')) {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Subscribe to updates
      const unsubscribe = subscribeToJob(jobId, (progress: JobProgress) => {
        if (!safeWrite(`data: ${JSON.stringify(progress)}\n\n`)) {
          unsubscribe()
          clearInterval(heartbeat)
          return
        }

        // Close connection when job completes, fails, or is cancelled
        if (
          progress.status === 'completed' ||
          progress.status === 'failed' ||
          progress.status === 'cancelled'
        ) {
          setTimeout(() => {
            clearInterval(heartbeat)
            unsubscribe()
            isConnectionOpen = false
            try {
              reply.raw.end()
            } catch {
              // Connection already closed
            }
          }, 1000)
        }
      })

      // Clean up on client disconnect
      request.raw.on('close', () => {
        isConnectionOpen = false
        clearInterval(heartbeat)
        unsubscribe()
      })

      // Handle errors on the response stream
      reply.raw.on('error', (err) => {
        logger.debug({ err, jobId }, 'SSE stream error (client likely disconnected)')
        isConnectionOpen = false
        clearInterval(heartbeat)
        unsubscribe()
      })
    }
  )

  /**
   * GET /api/jobs/active
   * Get all active/running jobs
   */
  fastify.get(
    '/api/jobs/active',
    { preHandler: requireAdmin, schema: jobSchemas.getActiveJobs },
    async (_request, reply) => {
      const allProgress = getAllJobProgress()
      return reply.send({ jobs: allProgress })
    }
  )
}
