/**
 * AI Explanation Generator
 *
 * Generates personalized explanations using actual embedding-based evidence
 * showing which watched movies are most similar to each recommendation.
 */

import { query } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import { getOpenAIClient } from '../../lib/openai.js'
import { getTextGenerationModel } from '../../settings/systemSettings.js'

const logger = createChildLogger('explanations')

export interface MovieForExplanation {
  movieId: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  similarity: number
  novelty: number
  ratingScore: number
}

export interface EvidenceMovie {
  title: string
  year: number | null
  similarity: number
  evidenceType: 'favorite' | 'highly_rated' | 'watched'
}

export interface MovieWithEvidence extends MovieForExplanation {
  evidence: EvidenceMovie[]
}

export interface ExplanationResult {
  movieId: string
  explanation: string
}

export interface UserTasteContext {
  topGenres: string[]
  favoriteMovies: { title: string; year: number | null; genres: string[] }[]
  tasteSynopsis: string | null
}

/**
 * Fetch embedding-based evidence for recommendations
 * This shows which watched movies are most similar to each recommendation
 */
async function fetchEvidenceForRecommendations(
  runId: string,
  movieIds: string[]
): Promise<Map<string, EvidenceMovie[]>> {
  const result = await query<{
    movie_id: string
    similar_title: string
    similar_year: number | null
    similarity: number
    evidence_type: string
  }>(
    `SELECT 
       rc.movie_id,
       m.title as similar_title,
       m.year as similar_year,
       re.similarity,
       re.evidence_type
     FROM recommendation_evidence re
     JOIN recommendation_candidates rc ON rc.id = re.candidate_id
     JOIN movies m ON m.id = re.similar_movie_id
     WHERE rc.run_id = $1 AND rc.movie_id = ANY($2)
     ORDER BY rc.movie_id, re.similarity DESC`,
    [runId, movieIds]
  )

  const evidenceMap = new Map<string, EvidenceMovie[]>()

  for (const row of result.rows) {
    if (!evidenceMap.has(row.movie_id)) {
      evidenceMap.set(row.movie_id, [])
    }
    evidenceMap.get(row.movie_id)!.push({
      title: row.similar_title,
      year: row.similar_year,
      similarity: row.similarity,
      evidenceType: row.evidence_type as 'favorite' | 'highly_rated' | 'watched',
    })
  }

  return evidenceMap
}

/**
 * Get rich user taste context
 */
async function getUserTasteContext(userId: string): Promise<UserTasteContext> {
  // Get top genres by watch frequency
  const genreResult = await query<{ genre: string }>(
    `SELECT unnest(m.genres) as genre, COUNT(*) as count
     FROM watch_history wh
     JOIN movies m ON m.id = wh.movie_id
     WHERE wh.user_id = $1
     GROUP BY genre
     ORDER BY count DESC
     LIMIT 8`,
    [userId]
  )

  // Get top favorite movies (by play count and favorite flag)
  const favoritesResult = await query<{
    title: string
    year: number | null
    genres: string[]
  }>(
    `SELECT m.title, m.year, m.genres
     FROM watch_history wh
     JOIN movies m ON m.id = wh.movie_id
     WHERE wh.user_id = $1
     ORDER BY wh.is_favorite DESC, wh.play_count DESC, wh.last_played_at DESC NULLS LAST
     LIMIT 15`,
    [userId]
  )

  // Get taste synopsis if available
  const synopsisResult = await query<{ taste_synopsis: string | null }>(
    `SELECT taste_synopsis FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  return {
    topGenres: genreResult.rows.map((r) => r.genre),
    favoriteMovies: favoritesResult.rows.map((r) => ({
      title: r.title,
      year: r.year,
      genres: r.genres || [],
    })),
    tasteSynopsis: synopsisResult.rows[0]?.taste_synopsis || null,
  }
}

/**
 * Generate AI explanations using actual embedding evidence
 */
export async function generateExplanations(
  runId: string,
  userId: string,
  recommendations: MovieForExplanation[]
): Promise<ExplanationResult[]> {
  if (recommendations.length === 0) {
    return []
  }

  logger.info(
    { runId, count: recommendations.length },
    '🤖 Generating AI explanations with embedding evidence'
  )

  // Fetch the actual embedding-based evidence
  const movieIds = recommendations.map((r) => r.movieId)
  const evidenceMap = await fetchEvidenceForRecommendations(runId, movieIds)

  // Get user taste context
  const tasteContext = await getUserTasteContext(userId)

  // Attach evidence to each recommendation
  const moviesWithEvidence: MovieWithEvidence[] = recommendations.map((r) => ({
    ...r,
    evidence: evidenceMap.get(r.movieId) || [],
  }))

  // Generate explanations in batches
  const batchSize = 10
  const results: ExplanationResult[] = []

  for (let i = 0; i < moviesWithEvidence.length; i += batchSize) {
    const batch = moviesWithEvidence.slice(i, i + batchSize)
    const batchResults = await generateBatchExplanations(batch, tasteContext)
    results.push(...batchResults)
  }

  logger.info({ generated: results.length }, '✅ AI explanations generated')
  return results
}

async function generateBatchExplanations(
  movies: MovieWithEvidence[],
  tasteContext: UserTasteContext
): Promise<ExplanationResult[]> {
  // Build user context string
  const userContextLines = [
    `Top genres: ${tasteContext.topGenres.join(', ')}`,
    '',
    `Most watched/favorite films:`,
    ...tasteContext.favoriteMovies
      .slice(0, 10)
      .map((m) => `- "${m.title}" (${m.year || 'N/A'}) - ${m.genres.join(', ')}`),
  ]

  if (tasteContext.tasteSynopsis) {
    userContextLines.unshift(`Taste Profile: ${tasteContext.tasteSynopsis}`, '')
  }

  const userContext = userContextLines.join('\n')

  // Build movie list with evidence
  const movieList = movies
    .map((m, i) => {
      const evidenceStr =
        m.evidence.length > 0
          ? m.evidence
              .map((e) => {
                const typeLabel =
                  e.evidenceType === 'favorite'
                    ? '⭐ favorite'
                    : e.evidenceType === 'highly_rated'
                      ? '🔥 highly rewatched'
                      : 'watched'
                return `"${e.title}" (${(e.similarity * 100).toFixed(0)}% match, ${typeLabel})`
              })
              .join(', ')
          : 'No direct match data'

      return `${i + 1}. "${m.title}" (${m.year || 'N/A'})
   Genres: ${m.genres.join(', ')}
   Overall match: ${(m.similarity * 100).toFixed(0)}% | Novelty: ${m.novelty > 0.5 ? 'expands taste' : 'familiar'} | Rating: ${m.ratingScore > 0.7 ? 'highly acclaimed' : m.ratingScore > 0.5 ? 'well received' : 'mixed'}
   🎯 SIMILAR TO MOVIES THEY'VE WATCHED: ${evidenceStr}
   Plot: ${(m.overview || 'No overview available').substring(0, 250)}...`
    })
    .join('\n\n')

  try {
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert film curator writing personalized recommendation explanations. You have access to:
1. The user's taste profile and favorite films
2. For each recommendation, the SPECIFIC watched movies it's most similar to (via AI embedding analysis)

Write compelling 3-4 sentence explanations for each recommendation. Your explanations MUST:
- Reference the SPECIFIC watched movies listed in "SIMILAR TO MOVIES THEY'VE WATCHED" for each recommendation
- Explain what qualities those movies share with the recommendation (themes, tone, directors, era, etc.)
- Be warm and conversational, like a knowledgeable friend
- Create excitement without spoiling plots

CRITICAL: Each recommendation shows which of the user's watched movies it's most similar to. USE THAT DATA - don't make up connections to random movies.

Format: Return JSON with an "explanations" array containing objects with "index" (1-based) and "explanation" fields.`,
        },
        {
          role: 'user',
          content: `=== USER'S TASTE PROFILE ===
${userContext}

=== RECOMMENDATIONS WITH SIMILARITY EVIDENCE ===
For each movie below, I've included which of the user's watched films it's most similar to based on AI analysis:

${movieList}

Generate personalized explanations referencing the specific similar movies shown for each recommendation.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      logger.warn('No response from OpenAI for explanations')
      return movies.map((m) => ({
        movieId: m.movieId,
        explanation: generateFallbackExplanation(m),
      }))
    }

    // Parse the JSON response
    const parsed = JSON.parse(content)
    const explanations = Array.isArray(parsed) ? parsed : parsed.explanations || []

    // Map back to movie IDs
    return movies.map((m, i) => {
      const found = explanations.find((e: { index: number; explanation: string }) => e.index === i + 1)
      return {
        movieId: m.movieId,
        explanation: found?.explanation || generateFallbackExplanation(m),
      }
    })
  } catch (error) {
    logger.error({ error }, 'Failed to generate explanations with OpenAI')
    return movies.map((m) => ({
      movieId: m.movieId,
      explanation: generateFallbackExplanation(m),
    }))
  }
}

function generateFallbackExplanation(movie: MovieWithEvidence): string {
  if (movie.evidence.length > 0) {
    const topMatch = movie.evidence[0]
    return `Based on your enjoyment of "${topMatch.title}", this ${movie.genres[0] || 'film'} shares similar qualities you'll likely appreciate.`
  }

  const reasons: string[] = []

  if (movie.similarity > 0.7) {
    reasons.push('strongly matches your viewing history')
  } else if (movie.similarity > 0.5) {
    reasons.push('aligns with your taste')
  }

  if (movie.novelty > 0.5) {
    reasons.push('introduces some fresh genres you might enjoy exploring')
  }

  if (movie.ratingScore > 0.7) {
    reasons.push('is highly acclaimed')
  }

  if (reasons.length === 0) {
    return `This ${movie.genres[0] || 'film'} offers something different from your usual picks.`
  }

  return `This ${movie.genres[0] || 'film'} ${reasons.join(' and ')}.`
}

/**
 * Store explanations in the database
 */
export async function storeExplanations(runId: string, explanations: ExplanationResult[]): Promise<void> {
  for (const exp of explanations) {
    await query(
      `UPDATE recommendation_candidates
       SET ai_explanation = $1
       WHERE run_id = $2 AND movie_id = $3 AND is_selected = true`,
      [exp.explanation, runId, exp.movieId]
    )
  }

  logger.info({ runId, count: explanations.length }, 'Stored AI explanations')
}

// Legacy export for backwards compatibility - will be removed
export type WatchedMovieForExplanation = {
  title: string
  year: number | null
  genres: string[]
  isFavorite: boolean
}
