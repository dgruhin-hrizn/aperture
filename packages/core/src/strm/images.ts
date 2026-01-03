import fs from 'fs/promises'
import { createChildLogger } from '../lib/logger.js'
import { createRankedPoster } from './poster.js'
import type { ImageDownloadTask } from './types.js'

const logger = createChildLogger('strm-images')

/**
 * Download an image from URL and save it locally
 * For posters, applies the ranked overlay with rank and match percentage
 */
export async function downloadImage(task: ImageDownloadTask): Promise<boolean> {
  const filename = task.path.split('/').pop()
  try {
    logger.info({ url: task.url.substring(0, 80), filename, isPoster: task.isPoster }, '📥 Downloading image...')
    const startTime = Date.now()
    const response = await fetch(task.url)
    if (!response.ok) {
      logger.warn({ url: task.url, status: response.status, filename }, '❌ Failed to download image')
      return false
    }
    let buffer: Buffer = Buffer.from(await response.arrayBuffer())
    
    // Apply ranked overlay for poster images
    if (task.isPoster && task.rank !== undefined && task.matchScore !== undefined) {
      try {
        logger.info({ filename, rank: task.rank, matchScore: task.matchScore }, '🎨 Applying ranked overlay...')
        const overlayBuffer = await createRankedPoster(buffer, task.rank, task.matchScore)
        buffer = Buffer.from(overlayBuffer)
        logger.info({ filename, newSizeKB: Math.round(buffer.byteLength / 1024) }, '🎨 Overlay applied successfully')
      } catch (overlayErr) {
        logger.warn({ err: overlayErr, filename }, '⚠️ Failed to apply overlay, saving original')
      }
    }
    
    const sizeKB = Math.round(buffer.byteLength / 1024)
    await fs.writeFile(task.path, buffer)
    const duration = Date.now() - startTime
    logger.info({ filename, sizeKB, durationMs: duration }, `✅ Image saved (${sizeKB}KB in ${duration}ms)`)
    return true
  } catch (err) {
    logger.error({ err, url: task.url, filename }, '❌ Error downloading image')
    return false
  }
}

