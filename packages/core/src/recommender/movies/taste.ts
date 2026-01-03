import { createChildLogger } from '../../lib/logger.js'
import { query } from '../../lib/db.js'
import { averageEmbeddings, getMovieEmbedding } from './embeddings.js'
import type { WatchedMovie } from '../types.js'

const logger = createChildLogger('recommender-taste')

export async function getWatchHistory(userId: string, limit: number): Promise<WatchedMovie[]> {
  // Get ALL watch history up to limit, using a smarter ordering:
  // - Favorites first (always include these)
  // - Then by a combination of play count and recency
  // This ensures we capture the full breadth of user's taste
  const result = await query<{
    movie_id: string
    last_played_at: Date | null
    play_count: number
    is_favorite: boolean
  }>(
    `SELECT movie_id, last_played_at, play_count, is_favorite
     FROM watch_history
     WHERE user_id = $1
     ORDER BY 
       is_favorite DESC,
       play_count DESC,
       last_played_at DESC NULLS LAST
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => ({
    movieId: row.movie_id,
    lastPlayedAt: row.last_played_at,
    playCount: row.play_count,
    isFavorite: row.is_favorite,
  }))
}

export async function buildTasteProfile(watched: WatchedMovie[]): Promise<number[] | null> {
  const embeddings: number[][] = []
  const weights: number[] = []

  // Get movie ratings and genres for additional context
  const movieIds = watched.map((w) => w.movieId)
  const movieDataResult = await query<{
    id: string
    community_rating: number | null
    genres: string[]
  }>(`SELECT id, community_rating, genres FROM movies WHERE id = ANY($1)`, [movieIds])
  const movieData = new Map(movieDataResult.rows.map((r) => [r.id, r]))

  // Calculate stats for normalization
  const maxPlayCount = Math.max(...watched.map((w) => w.playCount), 1)
  const favoriteCount = watched.filter((w) => w.isFavorite).length
  const totalMovies = watched.length

  logger.debug(
    {
      totalMovies,
      favoriteCount,
      maxPlayCount,
    },
    'Building taste profile from watch history'
  )

  for (let i = 0; i < watched.length; i++) {
    const movie = watched[i]
    const emb = await getMovieEmbedding(movie.movieId)
    if (emb) {
      embeddings.push(emb)

      // Balanced multi-factor weighting
      // Goal: capture full breadth of taste without over-weighting any single factor
      let weight = 1.0

      // 1. Position weight - slight preference for movies that appear earlier
      // (already sorted by favorites, play count, recency)
      // Very gentle decay so we don't ignore movies at the end
      const positionFactor = 1 - (i / totalMovies) * 0.3 // Range: 0.7 to 1.0
      weight *= positionFactor

      // 2. Play count - normalized logarithmic boost
      // Prevents a single rewatched movie from dominating
      if (movie.playCount > 1) {
        const normalizedPlayCount = Math.log2(movie.playCount + 1) / Math.log2(maxPlayCount + 1)
        weight *= 1 + normalizedPlayCount * 0.4 // Up to 40% boost for most rewatched
      }

      // 3. Favorite boost - meaningful but not overwhelming
      // If user has many favorites, reduce individual favorite weight
      if (movie.isFavorite) {
        const favoriteBoost = favoriteCount > 20 ? 1.3 : favoriteCount > 10 ? 1.5 : 1.8
        weight *= favoriteBoost
      }

      // 4. Rating influence - slight boost for critically acclaimed choices
      const data = movieData.get(movie.movieId)
      if (data?.community_rating && data.community_rating >= 7.5) {
        weight *= 1 + (data.community_rating - 7) * 0.05 // Max ~15% boost for 10-rated films
      }

      weights.push(weight)
    }
  }

  if (embeddings.length === 0) {
    return null
  }

  // Normalize weights to prevent any single movie from having outsized influence
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const avgWeight = totalWeight / weights.length
  const normalizedWeights = weights.map((w) => {
    // Cap any weight at 3x the average to ensure diversity
    return Math.min(w, avgWeight * 3)
  })

  logger.debug(
    {
      embeddingCount: embeddings.length,
      totalWeight: totalWeight.toFixed(2),
      avgWeight: avgWeight.toFixed(2),
      topWeights: normalizedWeights.slice(0, 5).map((w) => w.toFixed(2)),
    },
    'Taste profile weights calculated'
  )

  return averageEmbeddings(embeddings, normalizedWeights)
}

export async function storeTasteProfile(userId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`

  await query(
    `INSERT INTO user_preferences (user_id, taste_embedding, taste_embedding_updated_at)
     VALUES ($1, $2::halfvec, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       taste_embedding = EXCLUDED.taste_embedding,
       taste_embedding_updated_at = NOW()`,
    [userId, vectorStr]
  )
}

