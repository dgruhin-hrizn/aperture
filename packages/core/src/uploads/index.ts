/**
 * Uploads Module
 * Manages image uploads for libraries, collections, and playlists
 */

import { query, queryOne, transaction } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import {
  saveFile,
  deleteFile,
  readFile,
  fileExists,
  getAbsolutePath,
  cleanupEntityFiles,
  ensureUploadsDir,
  getUploadsDir,
  type StoredFile,
} from './storage.js'

const logger = createChildLogger('uploads')

export type EntityType = 'library' | 'collection' | 'playlist'

export interface MediaImage {
  id: string
  entityType: EntityType
  entityId: string
  imageType: string
  isDefault: boolean
  userId: string | null
  filePath: string
  originalFilename: string | null
  mimeType: string
  width: number | null
  height: number | null
  createdAt: Date
  updatedAt: Date
}

export interface UploadImageOptions {
  entityType: EntityType
  entityId: string
  imageType: string
  buffer: Buffer
  originalFilename: string
  mimeType: string
  width?: number
  height?: number
  userId?: string // null for admin defaults
  isDefault?: boolean
}

export interface ImageDimensions {
  width: number
  height: number
}

// Recommended dimensions for each entity/image type combination
export const RECOMMENDED_DIMENSIONS: Record<string, Record<string, ImageDimensions>> = {
  library: {
    Primary: { width: 1920, height: 1080 }, // 16:9 landscape banner
  },
  collection: {
    Primary: { width: 400, height: 600 }, // 2:3 portrait poster
  },
  playlist: {
    Primary: { width: 400, height: 600 }, // 2:3 portrait poster
  },
}

/**
 * Initialize the uploads system
 */
export async function initUploads(): Promise<void> {
  await ensureUploadsDir()
  logger.info({ dir: getUploadsDir() }, 'Uploads system initialized')
}

/**
 * Upload and save an image
 */
export async function uploadImage(options: UploadImageOptions): Promise<MediaImage> {
  const {
    entityType,
    entityId,
    imageType,
    buffer,
    originalFilename,
    mimeType,
    width,
    height,
    userId,
    isDefault = false,
  } = options

  logger.info(
    { entityType, entityId, imageType, isDefault, userId, size: buffer.length },
    'Uploading image'
  )

  // Save file to filesystem
  const stored = await saveFile({
    entityType,
    entityId,
    imageType,
    buffer,
    originalFilename,
    mimeType,
  })

  // Use transaction to handle cleanup and insert
  return transaction(async (client) => {
    // If this is a default, remove any existing default for this entity/imageType
    if (isDefault) {
      const existing = await client.query<{ file_path: string }>(
        `SELECT file_path FROM media_images 
         WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND is_default = true`,
        [entityType, entityId, imageType]
      )

      if (existing.rows.length > 0) {
        // Delete old file
        await deleteFile(existing.rows[0].file_path)
        // Remove old record
        await client.query(
          `DELETE FROM media_images 
           WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND is_default = true`,
          [entityType, entityId, imageType]
        )
      }
    }

    // If this is a user override, remove any existing override for this user/entity/imageType
    if (userId) {
      const existing = await client.query<{ file_path: string }>(
        `SELECT file_path FROM media_images 
         WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND user_id = $4`,
        [entityType, entityId, imageType, userId]
      )

      if (existing.rows.length > 0) {
        // Delete old file
        await deleteFile(existing.rows[0].file_path)
        // Remove old record
        await client.query(
          `DELETE FROM media_images 
           WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND user_id = $4`,
          [entityType, entityId, imageType, userId]
        )
      }
    }

    // Insert new record
    const result = await client.query<{
      id: string
      entity_type: EntityType
      entity_id: string
      image_type: string
      is_default: boolean
      user_id: string | null
      file_path: string
      original_filename: string | null
      mime_type: string
      width: number | null
      height: number | null
      created_at: Date
      updated_at: Date
    }>(
      `INSERT INTO media_images (
        entity_type, entity_id, image_type, is_default, user_id,
        file_path, original_filename, mime_type, width, height
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        entityType,
        entityId,
        imageType,
        isDefault,
        userId || null,
        stored.filePath,
        originalFilename,
        mimeType,
        width || null,
        height || null,
      ]
    )

    const row = result.rows[0]
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      imageType: row.image_type,
      isDefault: row.is_default,
      userId: row.user_id,
      filePath: row.file_path,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}

/**
 * Get the effective image for an entity (user override or default)
 */
export async function getEffectiveImage(
  entityType: EntityType,
  entityId: string,
  imageType: string,
  userId?: string
): Promise<MediaImage | null> {
  // First try to get user's custom image
  if (userId) {
    const userImage = await queryOne<MediaImage>(
      `SELECT 
        id, entity_type as "entityType", entity_id as "entityId", 
        image_type as "imageType", is_default as "isDefault", user_id as "userId",
        file_path as "filePath", original_filename as "originalFilename",
        mime_type as "mimeType", width, height, 
        created_at as "createdAt", updated_at as "updatedAt"
       FROM media_images 
       WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND user_id = $4`,
      [entityType, entityId, imageType, userId]
    )

    if (userImage) {
      return userImage
    }
  }

  // Fall back to default image
  const defaultImage = await queryOne<MediaImage>(
    `SELECT 
      id, entity_type as "entityType", entity_id as "entityId", 
      image_type as "imageType", is_default as "isDefault", user_id as "userId",
      file_path as "filePath", original_filename as "originalFilename",
      mime_type as "mimeType", width, height, 
      created_at as "createdAt", updated_at as "updatedAt"
     FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND is_default = true`,
    [entityType, entityId, imageType]
  )

  return defaultImage || null
}

/**
 * Get all images for an entity
 */
export async function getEntityImages(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<MediaImage[]> {
  const result = await query<{
    id: string
    entity_type: EntityType
    entity_id: string
    image_type: string
    is_default: boolean
    user_id: string | null
    file_path: string
    original_filename: string | null
    mime_type: string
    width: number | null
    height: number | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 
       AND (is_default = true OR user_id = $3)
     ORDER BY image_type, is_default DESC`,
    [entityType, entityId, userId || null]
  )

  return result.rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    imageType: row.image_type,
    isDefault: row.is_default,
    userId: row.user_id,
    filePath: row.file_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Delete a user's custom image (reverts to default)
 */
export async function deleteUserImage(
  entityType: EntityType,
  entityId: string,
  imageType: string,
  userId: string
): Promise<MediaImage | null> {
  const existing = await queryOne<{ id: string; file_path: string }>(
    `SELECT id, file_path FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND user_id = $4`,
    [entityType, entityId, imageType, userId]
  )

  if (!existing) {
    return null
  }

  // Delete file
  await deleteFile(existing.file_path)

  // Delete record
  await query(
    `DELETE FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND user_id = $4`,
    [entityType, entityId, imageType, userId]
  )

  logger.info({ entityType, entityId, imageType, userId }, 'User image deleted')

  // Return the default image if one exists
  return getEffectiveImage(entityType, entityId, imageType)
}

/**
 * Delete the default image for an entity
 */
export async function deleteDefaultImage(
  entityType: EntityType,
  entityId: string,
  imageType: string
): Promise<boolean> {
  const existing = await queryOne<{ id: string; file_path: string }>(
    `SELECT id, file_path FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND is_default = true`,
    [entityType, entityId, imageType]
  )

  if (!existing) {
    return false
  }

  // Delete file
  await deleteFile(existing.file_path)

  // Delete record
  await query(
    `DELETE FROM media_images 
     WHERE entity_type = $1 AND entity_id = $2 AND image_type = $3 AND is_default = true`,
    [entityType, entityId, imageType]
  )

  logger.info({ entityType, entityId, imageType }, 'Default image deleted')
  return true
}

/**
 * Read an image file
 */
export async function getImageBuffer(filePath: string): Promise<Buffer | null> {
  if (!(await fileExists(filePath))) {
    return null
  }
  return readFile(filePath)
}

/**
 * Get absolute path for serving
 */
export { getAbsolutePath, getUploadsDir }

// Re-export types
export type { StoredFile }

// Media server sync
export {
  pushImageToMediaServer,
  deleteImageFromMediaServer,
  syncEntityImageToMediaServer,
  syncAllEntityImagesToMediaServer,
  syncLibraryTypeImage,
  type ImageSyncResult,
  type LibraryType,
} from './mediaServerSync.js'

