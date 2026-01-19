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
  type ApiKey,
  type ApiKeyWithUser,
} from '@aperture/core'
import { requireAuth, requireAdmin } from '../plugins/auth.js'

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

// OpenAPI schemas
const apiKeySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'Unique identifier for the API key' },
    userId: { type: 'string', format: 'uuid', description: 'ID of the user who owns the key' },
    name: { type: 'string', description: 'Descriptive name for the API key' },
    keyPrefix: { type: 'string', description: 'First 8 characters of the key for identification' },
    expiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'Expiration date or null for never' },
    lastUsedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last time the key was used' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    revokedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Revocation timestamp if revoked' },
  },
}

const expirationOptionSchema = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Human-readable label' },
    days: { type: 'integer', nullable: true, description: 'Number of days until expiration, or null for never' },
  },
}

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/api-keys
   * List API keys for the current user (or all keys for admins)
   */
  fastify.get<{ Querystring: ListApiKeysQuery }>(
    '/api/api-keys',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'List API keys',
        description: 'List all API keys for the current user. Admins can see all keys.',
        querystring: {
          type: 'object',
          properties: {
            includeRevoked: { type: 'string', enum: ['true', 'false'], description: 'Include revoked keys' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              keys: { type: 'array', items: apiKeySchema },
              expirationOptions: { type: 'array', items: expirationOptionSchema },
            },
          },
        },
      },
    },
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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'Create API key',
        description: 'Create a new API key. The plaintext key is only returned once - make sure to save it.',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255, description: 'Descriptive name for the key' },
            expiresInDays: { type: 'integer', minimum: 1, maximum: 365, nullable: true, description: 'Days until expiration, or null for never' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              apiKey: apiKeySchema,
              plaintextKey: { type: 'string', description: 'The API key - only shown once!' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'Get API key',
        description: 'Get details about a specific API key',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'API key ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { apiKey: apiKeySchema },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'Update API key',
        description: 'Update an API key name or expiration date',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'API key ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255, description: 'New name for the key' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'New expiration date' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { apiKey: apiKeySchema },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'Revoke or delete API key',
        description: 'Revoke an API key (soft delete) or permanently delete it',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'API key ID' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            permanent: { type: 'string', enum: ['true', 'false'], description: 'Permanently delete instead of revoke' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['api-keys'],
        summary: 'Get expiration options',
        description: 'Get the list of available expiration options for API key creation',
        response: {
          200: {
            type: 'object',
            properties: {
              options: { type: 'array', items: expirationOptionSchema },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ options: EXPIRATION_OPTIONS })
    }
  )
}

export default apiKeysRoutes
