import fs from 'fs/promises'
import { createChildLogger } from '../lib/logger.js'
import { createRankedPoster, createTopPicksPoster } from './poster.js'
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
      if (response.status === 404) {
        // 404 is normal - not all items have all artwork types (banner, logo, clearart, thumb)
        logger.debug({ filename, status: response.status }, `⏭️ Skipping ${filename} - source item does not have this artwork`)
      } else {
        logger.warn({ url: task.url, status: response.status, filename }, '❌ Failed to download image')
      }
      return false
    }
    let buffer: Buffer = Buffer.from(await response.arrayBuffer())
    
    // Apply overlay for poster images based on mode
    if (task.isPoster && task.rank !== undefined) {
      try {
        if (task.mode === 'top-picks') {
          // Top Picks mode: rank-only badge in upper-right
          logger.info({ filename, rank: task.rank, mode: 'top-picks' }, '🎨 Applying Top Picks overlay...')
          const overlayBuffer = await createTopPicksPoster(buffer, task.rank)
          buffer = Buffer.from(overlayBuffer)
          logger.info({ filename, newSizeKB: Math.round(buffer.byteLength / 1024) }, '🎨 Top Picks overlay applied successfully')
        } else if (task.matchScore !== undefined) {
          // Recommendation mode: rank + match percentage badges
          logger.info({ filename, rank: task.rank, matchScore: task.matchScore, mode: 'recommendation' }, '🎨 Applying ranked overlay...')
          const overlayBuffer = await createRankedPoster(buffer, task.rank, task.matchScore)
          buffer = Buffer.from(overlayBuffer)
          logger.info({ filename, newSizeKB: Math.round(buffer.byteLength / 1024) }, '🎨 Overlay applied successfully')
        }
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

