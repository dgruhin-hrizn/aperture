import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { generateChannelRecommendations } from './recommendations.js'

const logger = createChildLogger('channels')

/**
 * Update a channel's playlist in the media server
 */
export async function updateChannelPlaylist(channelId: string): Promise<string> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key is not configured')
  }

  // Get channel details with owner info
  const channel = await queryOne<{
    id: string
    owner_id: string
    name: string
    playlist_id: string | null
    provider_user_id: string
    display_name: string | null
    username: string
  }>(
    `SELECT c.*, u.provider_user_id, u.display_name, u.username
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  // Generate recommendations
  const recommendations = await generateChannelRecommendations(channelId)
  const itemIds = recommendations.map((r) => r.providerItemId)

  // Create/update playlist
  const result = await provider.createOrUpdatePlaylist(
    apiKey,
    channel.provider_user_id,
    channel.name,
    itemIds
  )

  // Store playlist ID if new
  if (!channel.playlist_id || channel.playlist_id !== result.playlistId) {
    await query(
      `UPDATE channels SET playlist_id = $1, last_generated_at = NOW() WHERE id = $2`,
      [result.playlistId, channelId]
    )

    // Also store in playlists table
    await query(
      `INSERT INTO playlists (user_id, channel_id, name, provider_playlist_id, playlist_type, item_count)
       VALUES ($1, $2, $3, $4, 'channel', $5)
       ON CONFLICT DO NOTHING`,
      [channel.owner_id, channelId, channel.name, result.playlistId, itemIds.length]
    )
  } else {
    await query(
      `UPDATE channels SET last_generated_at = NOW() WHERE id = $1`,
      [channelId]
    )
  }

  logger.info({ channelId, playlistId: result.playlistId, itemCount: itemIds.length }, 'Channel playlist updated')

  return result.playlistId
}

/**
 * Create shared playlist for a channel viewer
 */
export async function createSharedPlaylist(
  channelId: string,
  sharedWithUserId: string
): Promise<string> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key is not configured')
  }

  // Get channel details
  const channel = await queryOne<{
    id: string
    name: string
    owner_username: string
    owner_display_name: string | null
  }>(
    `SELECT c.id, c.name, u.username as owner_username, u.display_name as owner_display_name
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  // Get viewer's provider user ID
  const viewer = await queryOne<{ provider_user_id: string }>(
    'SELECT provider_user_id FROM users WHERE id = $1',
    [sharedWithUserId]
  )

  if (!viewer) {
    throw new Error(`User not found: ${sharedWithUserId}`)
  }

  // Generate recommendations for the channel
  const recommendations = await generateChannelRecommendations(channelId)
  const itemIds = recommendations.map((r) => r.providerItemId)

  // Create playlist with owner's name
  const ownerName = channel.owner_display_name || channel.owner_username
  const playlistName = `${ownerName} - ${channel.name}`

  const result = await provider.createOrUpdatePlaylist(
    apiKey,
    viewer.provider_user_id,
    playlistName,
    itemIds
  )

  // Store in channel_shares
  await query(
    `UPDATE channel_shares SET viewer_playlist_id = $1 WHERE channel_id = $2 AND shared_with_user_id = $3`,
    [result.playlistId, channelId, sharedWithUserId]
  )

  // Store in playlists table
  const share = await queryOne<{ id: string }>(
    'SELECT id FROM channel_shares WHERE channel_id = $1 AND shared_with_user_id = $2',
    [channelId, sharedWithUserId]
  )

  if (share) {
    await query(
      `INSERT INTO playlists (user_id, channel_id, name, provider_playlist_id, playlist_type, channel_share_id, item_count)
       VALUES ($1, $2, $3, $4, 'shared_channel', $5, $6)
       ON CONFLICT DO NOTHING`,
      [sharedWithUserId, channelId, playlistName, result.playlistId, share.id, itemIds.length]
    )
  }

  logger.info({ channelId, sharedWithUserId, playlistId: result.playlistId }, 'Shared playlist created')

  return result.playlistId
}

/**
 * Process all active channels (generate playlists)
 */
export async function processAllChannels(): Promise<{
  success: number
  failed: number
}> {
  const channels = await query<{ id: string; name: string }>(
    'SELECT id, name FROM channels WHERE is_active = true'
  )

  let success = 0
  let failed = 0

  for (const channel of channels.rows) {
    try {
      await updateChannelPlaylist(channel.id)

      // Also update shared playlists
      const shares = await query<{ shared_with_user_id: string }>(
        'SELECT shared_with_user_id FROM channel_shares WHERE channel_id = $1',
        [channel.id]
      )

      for (const share of shares.rows) {
        try {
          await createSharedPlaylist(channel.id, share.shared_with_user_id)
        } catch (err) {
          logger.error({ err, channelId: channel.id, userId: share.shared_with_user_id }, 'Failed to create shared playlist')
        }
      }

      success++
    } catch (err) {
      logger.error({ err, channelId: channel.id }, 'Failed to process channel')
      failed++
    }
  }

  return { success, failed }
}



