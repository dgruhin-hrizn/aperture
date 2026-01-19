import type { FastifyPluginAsync } from 'fastify'
import {
  createApiKey,
  listApiKeys,
  listAllApiKeys,
  getApiKey,
  revokeApiKey,
  deleteApiKey,
  updateApiKey,
  EXPIRATION_OPTIONS,
} from '@aperture/core'
import { requireAuth, requireAdmin } from '../../plugins/auth.js'
import {
  apiKeysSchemas,
  listApiKeysSchema,
  createApiKeySchema,
  getApiKeySchema,
  updateApiKeySchema,
  deleteApiKeySchema,
  getExpirationOptionsSchema,
} from './schemas.js'

interface CreateApiKeyBody {
  name: string
  expiresInDays: number | null
}

interface UpdateApiKeyBody {
  name?: string
  expiresAt?: string | null
}

interface ApiKeyParams {
  id: string
}

interface ListApiKeysQuery {
  includeRevoked?: string
}

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(apiKeysSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/api-keys
   * List API keys for the current user (or all keys for admins)
   */
  fastify.get<{ Querystring: ListApiKeysQuery }>(
    '/api/api-keys',
    { preHandler: requireAuth, schema: listApiKeysSchema },
    async (request, reply) => {
      const includeRevoked = request.query.includeRevoked === 'true'
      
      if (request.user!.isAdmin) {
        // Admins see all API keys
        const keys = await listAllApiKeys(includeRevoked)
        return reply.send({ keys, expirationOptions: EXPIRATION_OPTIONS })
      } else {
        // Regular users only see their own keys
        const keys = await listApiKeys(request.user!.id, includeRevoked)
        return reply.send({ keys, expirationOptions: EXPIRATION_OPTIONS })
      }
    }
  )

  /**
   * POST /api/api-keys
   * Create a new API key
   */
  fastify.post<{ Body: CreateApiKeyBody }>(
    '/api/api-keys',
    { preHandler: requireAuth, schema: createApiKeySchema },
    async (request, reply) => {
      const { name, expiresInDays } = request.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Name is required' })
      }

      if (name.length > 255) {
        return reply.status(400).send({ error: 'Name must be 255 characters or less' })
      }

      // Validate expiresInDays
      if (expiresInDays !== null) {
        if (typeof expiresInDays !== 'number' || expiresInDays < 1 || expiresInDays > 365) {
          return reply.status(400).send({ error: 'expiresInDays must be between 1 and 365, or null for never' })
        }
      }

      try {
        const result = await createApiKey(request.user!.id, name.trim(), expiresInDays)
        
        // Return the API key with the plaintext key (only time it's shown)
        return reply.status(201).send({
          apiKey: result.apiKey,
          plaintextKey: result.plaintextKey,
          message: 'API key created. Copy the key now - it will not be shown again.',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to create API key')
        return reply.status(500).send({ error: 'Failed to create API key' })
      }
    }
  )

  /**
   * GET /api/api-keys/:id
   * Get a single API key by ID
   */
  fastify.get<{ Params: ApiKeyParams }>(
    '/api/api-keys/:id',
    { preHandler: requireAuth, schema: getApiKeySchema },
    async (request, reply) => {
      const { id } = request.params

      const apiKey = await getApiKey(id)

      if (!apiKey) {
        return reply.status(404).send({ error: 'API key not found' })
      }

      // Non-admins can only view their own keys
      if (!request.user!.isAdmin && apiKey.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      return reply.send({ apiKey })
    }
  )

  /**
   * PATCH /api/api-keys/:id
   * Update an API key (name or expiration)
   */
  fastify.patch<{ Params: ApiKeyParams; Body: UpdateApiKeyBody }>(
    '/api/api-keys/:id',
    { preHandler: requireAuth, schema: updateApiKeySchema },
    async (request, reply) => {
      const { id } = request.params
      const { name, expiresAt } = request.body

      // First, check if the key exists and user has permission
      const existingKey = await getApiKey(id)

      if (!existingKey) {
        return reply.status(404).send({ error: 'API key not found' })
      }

      // Non-admins can only update their own keys
      if (!request.user!.isAdmin && existingKey.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Cannot update revoked keys
      if (existingKey.revokedAt) {
        return reply.status(400).send({ error: 'Cannot update a revoked API key' })
      }

      // Build updates
      const updates: { name?: string; expiresAt?: Date | null } = {}

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return reply.status(400).send({ error: 'Name cannot be empty' })
        }
        if (name.length > 255) {
          return reply.status(400).send({ error: 'Name must be 255 characters or less' })
        }
        updates.name = name.trim()
      }

      if (expiresAt !== undefined) {
        if (expiresAt === null) {
          updates.expiresAt = null
        } else {
          const date = new Date(expiresAt)
          if (isNaN(date.getTime())) {
            return reply.status(400).send({ error: 'Invalid date format for expiresAt' })
          }
          if (date < new Date()) {
            return reply.status(400).send({ error: 'expiresAt must be in the future' })
          }
          updates.expiresAt = date
        }
      }

      try {
        const updatedKey = await updateApiKey(id, updates)
        return reply.send({ apiKey: updatedKey })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to update API key')
        return reply.status(500).send({ error: 'Failed to update API key' })
      }
    }
  )

  /**
   * DELETE /api/api-keys/:id
   * Delete (revoke) an API key
   */
  fastify.delete<{ Params: ApiKeyParams; Querystring: { permanent?: string } }>(
    '/api/api-keys/:id',
    { preHandler: requireAuth, schema: deleteApiKeySchema },
    async (request, reply) => {
      const { id } = request.params
      const permanent = request.query.permanent === 'true'

      // First, check if the key exists and user has permission
      const existingKey = await getApiKey(id)

      if (!existingKey) {
        return reply.status(404).send({ error: 'API key not found' })
      }

      // Non-admins can only delete their own keys
      if (!request.user!.isAdmin && existingKey.userId !== request.user!.id) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        if (permanent) {
          // Hard delete (only for admins or if already revoked)
          if (!request.user!.isAdmin && !existingKey.revokedAt) {
            return reply.status(403).send({ error: 'Only admins can permanently delete active keys' })
          }
          await deleteApiKey(id)
          return reply.send({ success: true, message: 'API key permanently deleted' })
        } else {
          // Soft delete (revoke)
          if (existingKey.revokedAt) {
            return reply.status(400).send({ error: 'API key is already revoked' })
          }
          await revokeApiKey(id)
          return reply.send({ success: true, message: 'API key revoked' })
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to delete API key')
        return reply.status(500).send({ error: 'Failed to delete API key' })
      }
    }
  )

  /**
   * GET /api/api-keys/expiration-options
   * Get available expiration options for API key creation
   */
  fastify.get(
    '/api/api-keys/expiration-options',
    { preHandler: requireAuth, schema: getExpirationOptionsSchema },
    async (_request, reply) => {
      return reply.send({ options: EXPIRATION_OPTIONS })
    }
  )
}

export default apiKeysRoutes
