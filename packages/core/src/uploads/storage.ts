/**
 * File Storage Module
 * Handles local filesystem storage for uploaded images
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('file-storage')

// Base uploads directory - can be configured via environment
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

export interface StoredFile {
  filePath: string // Relative path from uploads dir
  absolutePath: string
  filename: string
  originalFilename: string
  mimeType: string
  size: number
}

export interface SaveFileOptions {
  entityType: 'library' | 'collection' | 'playlist'
  entityId: string
  imageType: string
  buffer: Buffer
  originalFilename: string
  mimeType: string
}

/**
 * Ensure the uploads directory structure exists
 */
export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  logger.debug({ dir: UPLOADS_DIR }, 'Uploads directory ensured')
}

/**
 * Get the directory path for an entity's images
 */
function getEntityDir(entityType: string, entityId: string): string {
  // Sanitize entityId to prevent path traversal
  const safeEntityId = entityId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(UPLOADS_DIR, entityType, safeEntityId)
}

/**
 * Generate a unique filename for an uploaded image
 */
function generateFilename(originalFilename: string, imageType: string): string {
  const ext = path.extname(originalFilename).toLowerCase() || '.jpg'
  const hash = crypto.randomBytes(8).toString('hex')
  return `${imageType.toLowerCase()}_${hash}${ext}`
}

/**
 * Save an uploaded file to the filesystem
 */
export async function saveFile(options: SaveFileOptions): Promise<StoredFile> {
  const { entityType, entityId, imageType, buffer, originalFilename, mimeType } = options

  // Ensure entity directory exists
  const entityDir = getEntityDir(entityType, entityId)
  await fs.mkdir(entityDir, { recursive: true })

  // Generate unique filename
  const filename = generateFilename(originalFilename, imageType)
  const absolutePath = path.join(entityDir, filename)
  const relativePath = path.relative(UPLOADS_DIR, absolutePath)

  // Write file
  await fs.writeFile(absolutePath, buffer)

  logger.info(
    { entityType, entityId, imageType, filename, size: buffer.length },
    'File saved successfully'
  )

  return {
    filePath: relativePath,
    absolutePath,
    filename,
    originalFilename,
    mimeType,
    size: buffer.length,
  }
}

/**
 * Delete a file from the filesystem
 */
export async function deleteFile(relativePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(UPLOADS_DIR, relativePath)
    await fs.unlink(absolutePath)
    logger.info({ path: relativePath }, 'File deleted')
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn({ path: relativePath }, 'File not found for deletion')
      return false
    }
    throw err
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(UPLOADS_DIR, relativePath)
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
}

/**
 * Read a file from storage
 */
export async function readFile(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(UPLOADS_DIR, relativePath)
  return fs.readFile(absolutePath)
}

/**
 * Get the absolute path for a relative file path
 */
export function getAbsolutePath(relativePath: string): string {
  return path.join(UPLOADS_DIR, relativePath)
}

/**
 * Get the uploads base directory
 */
export function getUploadsDir(): string {
  return UPLOADS_DIR
}

/**
 * Clean up old files for an entity (e.g., when replacing an image)
 */
export async function cleanupEntityFiles(
  entityType: string,
  entityId: string,
  imageType: string,
  exceptFilename?: string
): Promise<number> {
  const entityDir = getEntityDir(entityType, entityId)

  try {
    const files = await fs.readdir(entityDir)
    const prefix = `${imageType.toLowerCase()}_`
    let deleted = 0

    for (const file of files) {
      if (file.startsWith(prefix) && file !== exceptFilename) {
        await fs.unlink(path.join(entityDir, file))
        deleted++
      }
    }

    logger.debug({ entityType, entityId, imageType, deleted }, 'Cleaned up old files')
    return deleted
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0
    }
    throw err
  }
}

