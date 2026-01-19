/**
 * Image Management API Routes
 * Handles upload, retrieval, and deletion of images for libraries, collections, and playlists
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  uploadImage,
  getEffectiveImage,
  getEntityImages,
  deleteUserImage,
  deleteDefaultImage,
  getAbsolutePath,
  initUploads,
  RECOMMENDED_DIMENSIONS,
  syncEntityImageToMediaServer,
  type EntityType,
} from '@aperture/core'
import { requireAuth, requireAdmin, type SessionUser } from '../../plugins/auth.js'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import { imageSchemas } from './schemas.js'

const VALID_ENTITY_TYPES: EntityType[] = ['library', 'collection', 'playlist']
const VALID_IMAGE_TYPES = ['Primary', 'Backdrop', 'Banner']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface ImageParams {
  entityType: string
  entityId: string
}

interface ImageQuerystring {
  imageType?: string
}

// Initialize uploads system on module load
initUploads().catch((err) => {
  console.error('Failed to initialize uploads:', err)
})

const imageRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart support for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  })

  // Serve uploaded images statically
  await fastify.register(staticPlugin, {
    root: getAbsolutePath(''),
    prefix: '/api/uploads/',
    decorateReply: false,
  })

  /**
   * Get image info for an entity
   */
  fastify.get<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/images/:entityType/:entityId',
    { preHandler: requireAuth, schema: imageSchemas.getImage },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query
      const user = request.user as SessionUser

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      const image = await getEffectiveImage(entityType as EntityType, entityId, imageType, user.id)

      if (!image) {
        return reply.status(404).send({ error: 'No image found' })
      }

      return {
        ...image,
        url: `/api/uploads/${image.filePath}`,
        recommendedDimensions: RECOMMENDED_DIMENSIONS[entityType]?.[imageType] || null,
      }
    }
  )

  /**
   * Get all images for an entity
   */
  fastify.get<{ Params: ImageParams }>(
    '/api/images/:entityType/:entityId/all',
    { preHandler: requireAuth, schema: imageSchemas.getAllImages },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const user = request.user as SessionUser

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      const images = await getEntityImages(entityType as EntityType, entityId, user.id)

      return {
        images: images.map((img) => ({
          ...img,
          url: `/api/uploads/${img.filePath}`,
        })),
        recommendedDimensions: RECOMMENDED_DIMENSIONS[entityType] || {},
      }
    }
  )

  /**
   * Upload a new image (user override)
   */
  fastify.post<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/images/:entityType/:entityId',
    { preHandler: requireAuth, schema: imageSchemas.uploadImage },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query
      const user = request.user as SessionUser

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      if (!VALID_IMAGE_TYPES.includes(imageType)) {
        return reply.status(400).send({ error: `Invalid image type. Must be one of: ${VALID_IMAGE_TYPES.join(', ')}` })
      }

      try {
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' })
        }

        const mimeType = data.mimetype
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          return reply.status(400).send({
            error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
          })
        }

        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        let width: number | undefined
        let height: number | undefined

        try {
          const dims = getImageDimensions(buffer)
          width = dims?.width
          height = dims?.height
        } catch {
          // Ignore dimension parsing errors
        }

        const image = await uploadImage({
          entityType: entityType as EntityType,
          entityId,
          imageType,
          buffer,
          originalFilename: data.filename,
          mimeType,
          width,
          height,
          userId: user.id,
          isDefault: false,
        })

        syncEntityImageToMediaServer(entityType as EntityType, entityId, imageType, user.id).catch(
          (err) => fastify.log.error(err, 'Failed to sync image to media server')
        )

        return reply.status(201).send({
          ...image,
          url: `/api/uploads/${image.filePath}`,
        })
      } catch (err) {
        fastify.log.error(err, 'Failed to upload image')
        return reply.status(500).send({ error: 'Failed to upload image' })
      }
    }
  )

  /**
   * Delete user's custom image (reverts to default)
   */
  fastify.delete<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/images/:entityType/:entityId',
    { preHandler: requireAuth, schema: imageSchemas.deleteImage },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query
      const user = request.user as SessionUser

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      const defaultImage = await deleteUserImage(entityType as EntityType, entityId, imageType, user.id)

      if (defaultImage) {
        syncEntityImageToMediaServer(entityType as EntityType, entityId, imageType).catch((err) =>
          fastify.log.error(err, 'Failed to sync default image to media server after user image deletion')
        )
      }

      return {
        deleted: true,
        defaultImage: defaultImage
          ? {
              ...defaultImage,
              url: `/api/uploads/${defaultImage.filePath}`,
            }
          : null,
      }
    }
  )

  /**
   * Set default image (admin only)
   */
  fastify.post<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/admin/images/:entityType/:entityId/default',
    { preHandler: [requireAuth, requireAdmin], schema: imageSchemas.setDefaultImage },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      if (!VALID_IMAGE_TYPES.includes(imageType)) {
        return reply.status(400).send({ error: `Invalid image type. Must be one of: ${VALID_IMAGE_TYPES.join(', ')}` })
      }

      try {
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' })
        }

        const mimeType = data.mimetype
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          return reply.status(400).send({
            error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
          })
        }

        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        let width: number | undefined
        let height: number | undefined
        try {
          const dims = getImageDimensions(buffer)
          width = dims?.width
          height = dims?.height
        } catch {
          // Ignore
        }

        const image = await uploadImage({
          entityType: entityType as EntityType,
          entityId,
          imageType,
          buffer,
          originalFilename: data.filename,
          mimeType,
          width,
          height,
          isDefault: true,
        })

        syncEntityImageToMediaServer(entityType as EntityType, entityId, imageType).catch((err) =>
          fastify.log.error(err, 'Failed to sync default image to media server')
        )

        return reply.status(201).send({
          ...image,
          url: `/api/uploads/${image.filePath}`,
        })
      } catch (err) {
        fastify.log.error(err, 'Failed to upload default image')
        return reply.status(500).send({ error: 'Failed to upload default image' })
      }
    }
  )

  /**
   * Delete default image (admin only)
   */
  fastify.delete<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/admin/images/:entityType/:entityId/default',
    { preHandler: [requireAuth, requireAdmin], schema: imageSchemas.deleteDefaultImage },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      const deleted = await deleteDefaultImage(entityType as EntityType, entityId, imageType)

      if (!deleted) {
        return reply.status(404).send({ error: 'No default image found' })
      }

      return { deleted: true }
    }
  )

  /**
   * Import image from Emby (admin only)
   */
  fastify.post<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/admin/images/:entityType/:entityId/import-from-emby',
    { preHandler: [requireAuth, requireAdmin], schema: imageSchemas.importFromEmby },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      try {
        const { getMediaServerConfig } = await import('@aperture/core')
        const mediaServerConfig = await getMediaServerConfig()

        if (!mediaServerConfig.baseUrl || !mediaServerConfig.apiKey) {
          return reply.status(400).send({ error: 'Media server not configured' })
        }

        const imageUrl = `${mediaServerConfig.baseUrl}/Items/${entityId}/Images/${imageType}`
        const response = await fetch(imageUrl, {
          headers: {
            'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${mediaServerConfig.apiKey}"`,
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            return reply.status(404).send({ error: 'No image found on media server' })
          }
          throw new Error(`Failed to fetch image from media server: ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const buffer = Buffer.from(await response.arrayBuffer())

        const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg'
        const originalFilename = `imported-from-emby${ext}`

        let width: number | undefined
        let height: number | undefined
        try {
          const dims = getImageDimensions(buffer)
          width = dims?.width
          height = dims?.height
        } catch {
          // Ignore
        }

        const image = await uploadImage({
          entityType: entityType as EntityType,
          entityId,
          imageType,
          buffer,
          originalFilename,
          mimeType: contentType,
          width,
          height,
          isDefault: true,
        })

        fastify.log.info({ entityType, entityId, imageType }, 'Imported image from Emby')

        return reply.status(201).send({
          ...image,
          url: `/api/uploads/${image.filePath}`,
        })
      } catch (err) {
        fastify.log.error(err, 'Failed to import image from Emby')
        return reply.status(500).send({ error: 'Failed to import image from media server' })
      }
    }
  )

  /**
   * Check if Emby has an image for an entity
   */
  fastify.get<{ Params: ImageParams; Querystring: ImageQuerystring }>(
    '/api/images/:entityType/:entityId/emby-check',
    { preHandler: requireAuth, schema: imageSchemas.embyCheck },
    async (request, reply) => {
      const { entityType, entityId } = request.params
      const { imageType = 'Primary' } = request.query

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        return reply.status(400).send({ error: 'Invalid entity type' })
      }

      try {
        const { getMediaServerConfig } = await import('@aperture/core')
        const config = await getMediaServerConfig()

        if (!config.baseUrl || !config.apiKey) {
          return reply.send({ hasImage: false, url: null })
        }

        const imageUrl = `${config.baseUrl}/Items/${entityId}/Images/${imageType}`
        const response = await fetch(imageUrl, {
          method: 'HEAD',
          headers: {
            'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${config.apiKey}"`,
          },
        })

        if (response.ok) {
          return reply.send({ 
            hasImage: true, 
            url: imageUrl,
            contentType: response.headers.get('content-type'),
            size: response.headers.get('content-length'),
          })
        }

        return reply.send({ hasImage: false, url: null })
      } catch (err) {
        fastify.log.error(err, 'Failed to check Emby image')
        return reply.send({ hasImage: false, url: null })
      }
    }
  )

  /**
   * Get recommended dimensions for entity types
   */
  fastify.get(
    '/api/images/dimensions',
    { schema: imageSchemas.getDimensions },
    async () => {
      return { dimensions: RECOMMENDED_DIMENSIONS }
    }
  )
}

/**
 * Simple image dimension parser for PNG and JPEG
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // Check for PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    return { width, height }
  }

  // Check for JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]

      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buffer.readUInt16BE(offset + 5)
        const width = buffer.readUInt16BE(offset + 7)
        return { width, height }
      }

      const length = buffer.readUInt16BE(offset + 2)
      offset += 2 + length
    }
  }

  return null
}

export default imageRoutes
