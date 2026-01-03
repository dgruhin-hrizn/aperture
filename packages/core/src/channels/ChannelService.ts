import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMovieEmbedding, averageEmbeddings } from '../recommender/embeddings.js'

const logger = createChildLogger('channels')

interface Channel {
  id: string
  ownerId: string
  name: string
  description: string | null
  genreFilters: string[]
  textPreferences: string | null
  exampleMovieIds: string[]
  isPinnedRow: boolean
  playlistId: string | null
  isActive: boolean
}

interface ChannelRecommendation {
  movieId: string
  providerItemId: string
  title: string
  year: number | null
  score: number
}

/**
 * Generate recommendations for a specific channel
 */
export async function generateChannelRecommendations(
  channelId: string,
  limit = 20
): Promise<ChannelRecommendation[]> {
  // Get channel details
  const channel = await queryOne<{
    id: string
    owner_id: string
    name: string
    genre_filters: string[]
    text_preferences: string | null
    example_movie_ids: string[]
  }>('SELECT * FROM channels WHERE id = $1', [channelId])

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  logger.info({ channelId, name: channel.name }, 'Generating channel recommendations')

  // Build channel taste profile from example movies
  let tasteProfile: number[] | null = null

  if (channel.example_movie_ids && channel.example_movie_ids.length > 0) {
    const embeddings: number[][] = []

    for (const movieId of channel.example_movie_ids) {
      const emb = await getMovieEmbedding(movieId)
      if (emb) {
        embeddings.push(emb)
      }
    }

    if (embeddings.length > 0) {
      tasteProfile = averageEmbeddings(embeddings)
    }
  }

  // Get user's watch history to exclude watched movies
  const watched = await query<{ movie_id: string }>(
    'SELECT movie_id FROM watch_history WHERE user_id = $1',
    [channel.owner_id]
  )
  const watchedIds = new Set(watched.rows.map((r) => r.movie_id))

  // Build query for candidates
  let whereClause = ''
  const params: unknown[] = []
  let paramIndex = 1

  // Genre filter
  if (channel.genre_filters && channel.genre_filters.length > 0) {
    whereClause = ` WHERE m.genres && $${paramIndex++}`
    params.push(channel.genre_filters)
  }

  let candidates: ChannelRecommendation[]

  if (tasteProfile) {
    // Use embedding similarity
    const vectorStr = `[${tasteProfile.join(',')}]`
    params.push(vectorStr)

    const result = await query<{
      id: string
      provider_item_id: string
      title: string
      year: number | null
      similarity: number
    }>(
      `SELECT m.id, m.provider_item_id, m.title, m.year,
              1 - (e.embedding <=> $${paramIndex}::halfvec) as similarity
       FROM embeddings e
       JOIN movies m ON m.id = e.movie_id
       ${whereClause}
       ORDER BY e.embedding <=> $${paramIndex}::halfvec
       LIMIT $${paramIndex + 1}`,
      [...params, limit + watchedIds.size]
    )

    candidates = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, limit)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.similarity,
      }))
  } else {
    // Fallback to rating-based ordering
    const result = await query<{
      id: string
      provider_item_id: string
      title: string
      year: number | null
      community_rating: number | null
    }>(
      `SELECT m.id, m.provider_item_id, m.title, m.year, m.community_rating
       FROM movies m
       ${whereClause}
       ORDER BY m.community_rating DESC NULLS LAST
       LIMIT $${paramIndex}`,
      [...params, limit + watchedIds.size]
    )

    candidates = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, limit)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.community_rating ? r.community_rating / 10 : 0.5,
      }))
  }

  return candidates
}

/**
 * Update a channel's playlist in the media server
 */
export async function updateChannelPlaylist(channelId: string): Promise<string> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
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
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
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

  const ownerName = channel.owner_display_name || channel.owner_username
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

