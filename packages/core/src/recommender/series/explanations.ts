/**
 * Series AI Explanation Generator
 *
 * Generates personalized explanations for TV series recommendations using
 * actual embedding-based evidence showing which watched series are most
 * similar to each recommendation.
 */

import OpenAI from 'openai'
import { query } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import { getTextGenerationModel, getOpenAIApiKey } from '../../settings/systemSettings.js'

const logger = createChildLogger('series-explanations')

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null

async function getOpenAIClient(): Promise<OpenAI> {
  if (!openaiClient) {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured. Please set it in Settings > AI.')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export interface SeriesForExplanation {
  seriesId: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  network: string | null
  status: string | null
  similarity: number
  novelty: number
  ratingScore: number
}

export interface EvidenceSeries {
  title: string
  year: number | null
  similarity: number
  evidenceType: 'favorite' | 'highly_rated' | 'watched'
}

export interface SeriesWithEvidence extends SeriesForExplanation {
  evidence: EvidenceSeries[]
}

export interface SeriesExplanationResult {
  seriesId: string
  explanation: string
}

export interface UserSeriesTasteContext {
  topGenres: string[]
  favoriteSeries: { title: string; year: number | null; genres: string[]; network: string | null }[]
  tasteSynopsis: string | null
}

/**
 * Fetch embedding-based evidence for series recommendations
 * Shows which watched series are most similar to each recommendation
 */
async function fetchSeriesEvidenceForRecommendations(
  runId: string,
  seriesIds: string[]
): Promise<Map<string, EvidenceSeries[]>> {
  const result = await query<{
    series_id: string
    similar_title: string
    similar_year: number | null
    similarity: number
    evidence_type: string
  }>(
    `SELECT 
       rc.series_id,
       s.title as similar_title,
       s.year as similar_year,
       re.similarity,
       re.evidence_type
     FROM recommendation_evidence re
     JOIN recommendation_candidates rc ON rc.id = re.candidate_id
     JOIN series s ON s.id = re.similar_series_id
     WHERE rc.run_id = $1 AND rc.series_id = ANY($2)
     ORDER BY rc.series_id, re.similarity DESC`,
    [runId, seriesIds]
  )

  const evidenceMap = new Map<string, EvidenceSeries[]>()

  for (const row of result.rows) {
    if (!evidenceMap.has(row.series_id)) {
      evidenceMap.set(row.series_id, [])
    }
    evidenceMap.get(row.series_id)!.push({
      title: row.similar_title,
      year: row.similar_year,
      similarity: row.similarity,
      evidenceType: row.evidence_type as 'favorite' | 'highly_rated' | 'watched',
    })
  }

  return evidenceMap
}

/**
 * Get rich user taste context for series
 */
async function getUserSeriesTasteContext(userId: string): Promise<UserSeriesTasteContext> {
  // Get top genres by watch frequency from series watch history
  const genreResult = await query<{ genre: string }>(
    `SELECT unnest(s.genres) as genre, COUNT(*) as count
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY genre
     ORDER BY count DESC
     LIMIT 8`,
    [userId]
  )

  // Get top favorite series (by episodes watched and engagement)
  const favoritesResult = await query<{
    title: string
    year: number | null
    genres: string[]
    network: string | null
  }>(
    `SELECT s.title, s.year, s.genres, s.network,
            COUNT(wh.id) as episodes_watched
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY s.id, s.title, s.year, s.genres, s.network
     ORDER BY episodes_watched DESC, MAX(wh.last_played_at) DESC NULLS LAST
     LIMIT 15`,
    [userId]
  )

  // Get series taste synopsis if available
  const synopsisResult = await query<{ series_taste_synopsis: string | null }>(
    `SELECT series_taste_synopsis FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  return {
    topGenres: genreResult.rows.map((r) => r.genre),
    favoriteSeries: favoritesResult.rows.map((r) => ({
      title: r.title,
      year: r.year,
      genres: r.genres || [],
      network: r.network,
    })),
    tasteSynopsis: synopsisResult.rows[0]?.series_taste_synopsis || null,
  }
}

/**
 * Generate AI explanations for series using actual embedding evidence
 */
export async function generateSeriesExplanations(
  runId: string,
  userId: string,
  recommendations: SeriesForExplanation[]
): Promise<SeriesExplanationResult[]> {
  if (recommendations.length === 0) {
    return []
  }

  logger.info(
    { runId, count: recommendations.length },
    '🤖 Generating AI explanations for series with embedding evidence'
  )

  // Fetch the actual embedding-based evidence
  const seriesIds = recommendations.map((r) => r.seriesId)
  const evidenceMap = await fetchSeriesEvidenceForRecommendations(runId, seriesIds)

  // Get user taste context
  const tasteContext = await getUserSeriesTasteContext(userId)

  // Attach evidence to each recommendation
  const seriesWithEvidence: SeriesWithEvidence[] = recommendations.map((r) => ({
    ...r,
    evidence: evidenceMap.get(r.seriesId) || [],
  }))

  // Generate explanations in batches
  const batchSize = 10
  const results: SeriesExplanationResult[] = []

  for (let i = 0; i < seriesWithEvidence.length; i += batchSize) {
    const batch = seriesWithEvidence.slice(i, i + batchSize)
    const batchResults = await generateBatchSeriesExplanations(batch, tasteContext)
    results.push(...batchResults)
  }

  logger.info({ generated: results.length }, '✅ Series AI explanations generated')
  return results
}

async function generateBatchSeriesExplanations(
  seriesList: SeriesWithEvidence[],
  tasteContext: UserSeriesTasteContext
): Promise<SeriesExplanationResult[]> {
  // Build user context string
  const userContextLines = [
    `Top genres: ${tasteContext.topGenres.join(', ')}`,
    '',
    `Most watched series:`,
    ...tasteContext.favoriteSeries
      .slice(0, 10)
      .map((s) => `- "${s.title}" (${s.year || 'N/A'}) - ${s.genres.join(', ')}${s.network ? ` on ${s.network}` : ''}`),
  ]

  if (tasteContext.tasteSynopsis) {
    userContextLines.unshift(`Taste Profile: ${tasteContext.tasteSynopsis}`, '')
  }

  const userContext = userContextLines.join('\n')

  // Build series list with evidence
  const seriesListStr = seriesList
    .map((s, i) => {
      const evidenceStr =
        s.evidence.length > 0
          ? s.evidence
              .map((e) => {
                const typeLabel =
                  e.evidenceType === 'favorite'
                    ? '⭐ favorite'
                    : e.evidenceType === 'highly_rated'
                      ? '🔥 binged'
                      : 'watched'
                return `"${e.title}" (${(e.similarity * 100).toFixed(0)}% match, ${typeLabel})`
              })
              .join(', ')
          : 'No direct match data'

      return `${i + 1}. "${s.title}" (${s.year || 'N/A'})
   Genres: ${s.genres.join(', ')}
   ${s.network ? `Network: ${s.network}` : ''}
   ${s.status ? `Status: ${s.status}` : ''}
   Overall match: ${(s.similarity * 100).toFixed(0)}% | Novelty: ${s.novelty > 0.5 ? 'expands taste' : 'familiar'} | Rating: ${s.ratingScore > 0.7 ? 'critically acclaimed' : s.ratingScore > 0.5 ? 'well received' : 'mixed'}
   🎯 SIMILAR TO SERIES THEY'VE WATCHED: ${evidenceStr}
   Plot: ${(s.overview || 'No overview available').substring(0, 250)}...`
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
          content: `You are an expert TV curator writing personalized recommendation explanations for TV series. You have access to:
1. The user's taste profile and favorite series
2. For each recommendation, the SPECIFIC watched series it's most similar to (via AI embedding analysis)

Write compelling 3-4 sentence explanations for each recommendation. Your explanations MUST:
- Reference the SPECIFIC watched series listed in "SIMILAR TO SERIES THEY'VE WATCHED" for each recommendation
- Explain what qualities those series share with the recommendation (themes, tone, showrunners, network style, etc.)
- Be warm and conversational, like a knowledgeable friend recommending their favorite shows
- Create excitement without spoiling plots
- Mention if it's from a network/streaming service they seem to enjoy

CRITICAL: Each recommendation shows which of the user's watched series it's most similar to. USE THAT DATA - don't make up connections to random series.

Format: Return JSON with an "explanations" array containing objects with "index" (1-based) and "explanation" fields.`,
        },
        {
          role: 'user',
          content: `=== USER'S TV TASTE PROFILE ===
${userContext}

=== RECOMMENDED SERIES WITH SIMILARITY EVIDENCE ===
For each series below, I've included which of the user's watched series it's most similar to based on AI analysis:

${seriesListStr}

Generate personalized explanations referencing the specific similar series shown for each recommendation.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      logger.warn('No response from OpenAI for series explanations')
      return seriesList.map((s) => ({
        seriesId: s.seriesId,
        explanation: generateFallbackSeriesExplanation(s),
      }))
    }

    // Parse the JSON response
    const parsed = JSON.parse(content)
    const explanations = Array.isArray(parsed) ? parsed : parsed.explanations || []

    // Map back to series IDs
    return seriesList.map((s, i) => {
      const found = explanations.find((e: { index: number; explanation: string }) => e.index === i + 1)
      return {
        seriesId: s.seriesId,
        explanation: found?.explanation || generateFallbackSeriesExplanation(s),
      }
    })
  } catch (error) {
    logger.error({ error }, 'Failed to generate series explanations with OpenAI')
    return seriesList.map((s) => ({
      seriesId: s.seriesId,
      explanation: generateFallbackSeriesExplanation(s),
    }))
  }
}

function generateFallbackSeriesExplanation(series: SeriesWithEvidence): string {
  if (series.evidence.length > 0) {
    const topMatch = series.evidence[0]
    return `Based on your enjoyment of "${topMatch.title}", this ${series.genres[0] || 'series'} shares similar qualities you'll likely appreciate.`
  }

  const reasons: string[] = []

  if (series.similarity > 0.7) {
    reasons.push('strongly matches your viewing history')
  } else if (series.similarity > 0.5) {
    reasons.push('aligns with your taste')
  }

  if (series.novelty > 0.5) {
    reasons.push('introduces some fresh genres you might enjoy exploring')
  }

  if (series.ratingScore > 0.7) {
    reasons.push('is critically acclaimed')
  }

  if (reasons.length === 0) {
    return `This ${series.genres[0] || 'series'} offers something different from your usual picks.`
  }

  return `This ${series.genres[0] || 'series'} ${reasons.join(' and ')}.`
}

/**
 * Store series explanations in the database
 */
export async function storeSeriesExplanations(
  runId: string,
  explanations: SeriesExplanationResult[]
): Promise<void> {
  for (const exp of explanations) {
    await query(
      `UPDATE recommendation_candidates
       SET ai_explanation = $1
       WHERE run_id = $2 AND series_id = $3 AND is_selected = true`,
      [exp.explanation, runId, exp.seriesId]
    )
  }

  logger.info({ runId, count: explanations.length }, 'Stored series AI explanations')
}


