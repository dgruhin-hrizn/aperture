import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { generateChannelRecommendations } from './recommendations.js'

const logger = createChildLogger('channels')

/**
 * Write STRM files for a pinned channel
 */
export async function writeChannelStrm(channelId: string): Promise<{
  written: number
  libraryPath: string
}> {
  // Get channel details
  const channel = await queryOne<{
    id: string
    name: string
    owner_id: string
    provider_user_id: string
    owner_display_name: string | null
    owner_username: string
  }>(
    `SELECT c.id, c.name, c.owner_id, u.provider_user_id, u.display_name as owner_display_name, u.username as owner_username
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1 AND c.is_pinned_row = true`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Pinned channel not found: ${channelId}`)
  }

  const libraryPathPrefix = process.env.AI_LIBRARY_PATH_PREFIX || '/strm/aperture/'
  const libraryPath = path.join(libraryPathPrefix, 'channels', channel.id)

  // Ensure directory exists
  await fs.mkdir(libraryPath, { recursive: true })

  // Generate recommendations
  const recommendations = await generateChannelRecommendations(channelId)

  // Write STRM files
  for (const rec of recommendations) {
    const filename = `${rec.title.replace(/[<>:"/\\|?*]/g, '')} (${rec.year || 'Unknown'}) [${rec.providerItemId}].strm`
    const filePath = path.join(libraryPath, filename)

    // Get streaming URL
    const provider = getMediaServerProvider()
    const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
    const content = provider.getStreamUrl(apiKey, rec.providerItemId)

    await fs.writeFile(filePath, content, 'utf-8')
  }

  logger.info({ channelId, written: recommendations.length, libraryPath }, 'Channel STRM files written')

  return {
    written: recommendations.length,
    libraryPath,
  }
}



