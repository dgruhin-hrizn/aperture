/**
 * Discovery Scorer
 * 
 * Scores and ranks discovery candidates using AI similarity and other factors
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getActiveEmbeddingTableName, getCurrentEmbeddingDimensions } from '../lib/ai-provider.js'
import type { MediaType, RawCandidate, ScoredCandidate, DiscoveryConfig } from './types.js'
import { getUserFranchisePreferences } from '../taste-profile/index.js'
import { detectFranchiseFromTitle } from '../taste-profile/franchise.js'

const logger = createChildLogger('discover:scorer')

/**
 * Get user's taste embedding for comparison
 */
async function getUserTasteEmbedding(userId: string, mediaType: MediaType): Promise<number[] | null> {
  const embeddingColumn = mediaType === 'movie' ? 'taste_embedding' : 'series_taste_embedding'
  
  const result = await queryOne<{ embedding: number[] }>(
    `SELECT ${embeddingColumn} as embedding FROM user_preferences WHERE user_id = $1`,
    [userId]
  )
  return result?.embedding ?? null
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * Normalize a value to 0-1 range using min-max scaling
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Calculate popularity score (0-1)
 */
function calculatePopularityScore(candidate: RawCandidate, allCandidates: RawCandidate[]): number {
  const popularities = allCandidates.map(c => c.popularity)
  const maxPopularity = Math.max(...popularities, 1)
  const minPopularity = Math.min(...popularities)
  
  return normalize(candidate.popularity, minPopularity, maxPopularity)
}

/**
 * Calculate recency score (0-1) - newer content gets higher scores
 */
function calculateRecencyScore(candidate: RawCandidate): number {
  if (!candidate.releaseYear) return 0.5
  
  const currentYear = new Date().getFullYear()
  const age = currentYear - candidate.releaseYear
  
  // 0 years old = 1.0, 10+ years old = 0.0
  return Math.max(0, Math.min(1, 1 - (age / 10)))
}

/**
 * Calculate source score (0-1) based on source reliability/relevance
 */
function calculateSourceScore(candidate: RawCandidate): number {
  // Prioritize personalized sources over general ones
  const sourceScores: Record<string, number> = {
    'trakt_recommendations': 1.0, // Most personalized
    'tmdb_recommendations': 0.9, // Based on user's watched
    'tmdb_similar': 0.85, // Based on user's ratings
    'trakt_trending': 0.7, // Current popularity
    'trakt_popular': 0.6, // All-time popularity
    'tmdb_discover': 0.5, // General popularity
    'mdblist': 0.6, // Curated lists
  }
  
  return sourceScores[candidate.source] ?? 0.5
}

/**
 * Score candidates based on similarity to user's taste and other factors
 */
export async function scoreCandidates(
  userId: string,
  mediaType: MediaType,
  candidates: RawCandidate[],
  config: DiscoveryConfig
): Promise<ScoredCandidate[]> {
  if (candidates.length === 0) {
    return []
  }

  logger.info({ userId, mediaType, candidateCount: candidates.length }, 'Scoring candidates')

  // Get user's taste embedding
  const tasteEmbedding = await getUserTasteEmbedding(userId, mediaType)
  
  // Get embeddings for candidates that are in our database
  const embeddingTable = await getActiveEmbeddingTableName(mediaType === 'movie' ? 'embeddings' : 'series_embeddings')
  const mediaTable = mediaType === 'movie' ? 'movies' : 'series'
  
  // Build a map of TMDb ID -> embedding for candidates we have in DB
  const tmdbIds = candidates.map(c => c.tmdbId.toString())
  
  let embeddingMap = new Map<number, number[]>()
  
  if (tasteEmbedding && tmdbIds.length > 0) {
    try {
      const embeddingResult = await query<{ tmdb_id: string; embedding: number[] }>(
        `SELECT m.tmdb_id, e.embedding 
         FROM ${mediaTable} m
         JOIN ${embeddingTable} e ON e.${mediaType === 'movie' ? 'movie_id' : 'series_id'} = m.id
         WHERE m.tmdb_id = ANY($1::text[])`,
        [tmdbIds]
      )
      
      for (const row of embeddingResult.rows) {
        const id = parseInt(row.tmdb_id, 10)
        if (!isNaN(id)) {
          embeddingMap.set(id, row.embedding)
        }
      }
      
      logger.debug({ 
        mediaType, 
        candidateCount: candidates.length, 
        embeddingsFound: embeddingMap.size 
      }, 'Loaded embeddings for candidates')
    } catch (err) {
      logger.warn({ err }, 'Failed to load embeddings for candidates')
    }
  }

  // Get user's franchise preferences for boosting
  // Note: Genre weights are not applied here since discovery uses TMDb genre IDs, not names
  const franchisePrefs = await getUserFranchisePreferences(userId, mediaType)
  
  // Build franchise lookup map
  const franchiseScoreMap = new Map<string, number>()
  for (const pref of franchisePrefs) {
    franchiseScoreMap.set(pref.franchiseName.toLowerCase(), pref.preferenceScore)
  }

  // Score each candidate
  const scoredCandidates: ScoredCandidate[] = candidates.map(candidate => {
    // Calculate similarity score
    let similarityScore = 0.5 // Default if no embedding available
    const candidateEmbedding = embeddingMap.get(candidate.tmdbId)
    if (tasteEmbedding && candidateEmbedding) {
      similarityScore = cosineSimilarity(tasteEmbedding, candidateEmbedding)
      // Normalize from [-1, 1] to [0, 1]
      similarityScore = (similarityScore + 1) / 2
    }

    const popularityScore = calculatePopularityScore(candidate, candidates)
    const recencyScore = calculateRecencyScore(candidate)
    const sourceScore = calculateSourceScore(candidate)

    // Calculate base score as weighted average
    let finalScore = (
      similarityScore * config.similarityWeight +
      popularityScore * config.popularityWeight +
      recencyScore * config.recencyWeight +
      sourceScore * 0.1 // Small boost for source quality
    )
    
    // Apply franchise preference boost
    let franchiseBoost = 1.0
    const detectedFranchise = detectFranchiseFromTitle(candidate.title)
    if (detectedFranchise) {
      const prefScore = franchiseScoreMap.get(detectedFranchise.toLowerCase())
      if (prefScore !== undefined) {
        // Convert -1 to 1 preference score to 0.5x to 1.5x multiplier
        franchiseBoost = 1.0 + prefScore * 0.5
      }
    }
    
    // Apply franchise boost to final score
    finalScore *= franchiseBoost

    return {
      ...candidate,
      finalScore,
      similarityScore,
      popularityScore,
      recencyScore,
      sourceScore,
      scoreBreakdown: {
        similarity: similarityScore,
        popularity: popularityScore,
        recency: recencyScore,
        source: sourceScore,
      },
      // isEnriched will be set by the pipeline after lazy enrichment
      isEnriched: false,
    }
  })

  // Sort by final score descending
  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore)

  // Assign ranks (to all candidates, not limited)
  scoredCandidates.forEach((c, i) => {
    (c as ScoredCandidate & { rank: number }).rank = i + 1
  })

  logger.info({
    userId,
    mediaType,
    inputCount: candidates.length,
    outputCount: scoredCandidates.length,
    topScore: scoredCandidates[0]?.finalScore.toFixed(3),
    bottomScore: scoredCandidates[scoredCandidates.length - 1]?.finalScore.toFixed(3),
  }, 'Scored and ranked candidates')

  // Return all scored candidates - limiting is done in the pipeline
  return scoredCandidates
}

