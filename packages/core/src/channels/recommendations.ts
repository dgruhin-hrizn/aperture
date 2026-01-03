import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMovieEmbedding, averageEmbeddings } from '../recommender/movies/embeddings.js'
import type { ChannelRecommendation } from './types.js'
import { weightedRandomSample } from './utils.js'

const logger = createChildLogger('channels')

/**
 * Generate recommendations for a specific channel
 */
export async function generateChannelRecommendations(
  channelId: string,
  limit = 20
): Promise<ChannelRecommendation[]> {
  // Get channel details with owner's parental rating
  const channel = await queryOne<{
    id: string
    owner_id: string
    name: string
    genre_filters: string[]
    text_preferences: string | null
    example_movie_ids: string[]
    max_parental_rating: number | null
  }>(
    `SELECT c.*, u.max_parental_rating 
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  logger.info({ 
    channelId, 
    name: channel.name, 
    maxParentalRating: channel.max_parental_rating 
  }, 'Generating channel recommendations')

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
  const whereClauses: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Genre filter
  if (channel.genre_filters && channel.genre_filters.length > 0) {
    whereClauses.push(`m.genres && $${paramIndex++}`)
    params.push(channel.genre_filters)
  }

  // Parental rating filter - filter movies based on user's max allowed rating
  if (channel.max_parental_rating !== null) {
    whereClauses.push(`(
      m.content_rating IS NULL OR
      COALESCE((SELECT prv.rating_value FROM parental_rating_values prv WHERE prv.rating_name = m.content_rating LIMIT 1), 0) <= $${paramIndex++}
    )`)
    params.push(channel.max_parental_rating)
  }

  const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''

  // Fetch more candidates than needed (3x) to enable variety through weighted sampling
  const poolSize = limit * 3

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
      [...params, poolSize + watchedIds.size]
    )

    const pool = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, poolSize)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.similarity,
      }))

    // Weighted random sampling for variety
    candidates = weightedRandomSample(pool, limit)
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
      [...params, poolSize + watchedIds.size]
    )

    const pool = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, poolSize)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.community_rating ? r.community_rating / 10 : 0.5,
      }))

    // Weighted random sampling for variety
    candidates = weightedRandomSample(pool, limit)
  }

  logger.info(
    { channelId, candidateCount: candidates.length, topScores: candidates.slice(0, 3).map((c) => c.score.toFixed(3)) },
    'Generated channel recommendations with variability'
  )

  return candidates
}

