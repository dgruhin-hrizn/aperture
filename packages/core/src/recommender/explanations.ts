/**
 * AI Explanation Generator
 * 
 * Generates personalized explanations for why each movie was recommended.
 */

import OpenAI from 'openai'
import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('explanations')

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

export interface WatchedMovieForExplanation {
  title: string
  year: number | null
  genres: string[]
  isFavorite: boolean
}

export interface ExplanationResult {
  movieId: string
  explanation: string
}

/**
 * Generate AI explanations for selected recommendations
 */
export async function generateExplanations(
  recommendations: MovieForExplanation[],
  watchedMovies: WatchedMovieForExplanation[],
  topGenres: string[]
): Promise<ExplanationResult[]> {
  if (recommendations.length === 0) {
    return []
  }

  logger.info({ count: recommendations.length }, '🤖 Generating AI explanations for recommendations')

  // Build context about user's taste
  const userContext = buildUserContext(watchedMovies, topGenres)

  // Generate explanations in batches to be efficient
  const batchSize = 10
  const results: ExplanationResult[] = []

  for (let i = 0; i < recommendations.length; i += batchSize) {
    const batch = recommendations.slice(i, i + batchSize)
    const batchResults = await generateBatchExplanations(batch, userContext)
    results.push(...batchResults)
  }

  logger.info({ generated: results.length }, '✅ AI explanations generated')
  return results
}

function buildUserContext(
  watchedMovies: WatchedMovieForExplanation[],
  topGenres: string[]
): string {
  const favorites = watchedMovies.filter(m => m.isFavorite).slice(0, 5)
  const recent = watchedMovies.slice(0, 10)

  const lines = [
    `User's top genres: ${topGenres.join(', ')}`,
    '',
    `Recent favorites:`,
    ...favorites.map(m => `- "${m.title}" (${m.year || 'N/A'}) - ${m.genres.join(', ')}`),
    '',
    `Recent watches:`,
    ...recent.map(m => `- "${m.title}" (${m.year || 'N/A'})`),
  ]

  return lines.join('\n')
}

async function generateBatchExplanations(
  movies: MovieForExplanation[],
  userContext: string
): Promise<ExplanationResult[]> {
  // Build the movie list for the prompt
  const movieList = movies.map((m, i) => {
    const score = {
      similarity: (m.similarity * 100).toFixed(0),
      novelty: m.novelty > 0.5 ? 'introduces new genres' : 'familiar style',
      rating: m.ratingScore > 0.7 ? 'highly rated' : m.ratingScore > 0.5 ? 'well rated' : 'mixed reviews',
    }
    return `${i + 1}. "${m.title}" (${m.year || 'N/A'})
   Genres: ${m.genres.join(', ')}
   Match: ${score.similarity}% similar to taste, ${score.novelty}, ${score.rating}
   Overview: ${(m.overview || 'No overview available').substring(0, 200)}...`
  }).join('\n\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly movie recommendation assistant. Generate a brief, personalized explanation (1-2 sentences) for why each movie was recommended to this user.

Rules:
- Be specific about WHY this movie matches their taste
- Reference their favorite genres, movies, or viewing patterns when relevant
- Don't repeat the movie's plot - they can read that elsewhere
- Be warm and conversational, like a friend suggesting a movie
- Keep each explanation under 50 words
- Format: Return a JSON array with objects containing "index" (1-based) and "explanation" fields

Example output:
[
  {"index": 1, "explanation": "Your love of sci-fi thrillers meets this mind-bending story. It has that same intensity as Inception, which you enjoyed."},
  {"index": 2, "explanation": "Given your recent interest in animated films, this Oscar-winner brings the emotional depth you appreciate."}
]`,
        },
        {
          role: 'user',
          content: `User's taste profile:
${userContext}

Generate explanations for these recommended movies:

${movieList}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      logger.warn('No response from OpenAI for explanations')
      return movies.map(m => ({
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
    return movies.map(m => ({
      movieId: m.movieId,
      explanation: generateFallbackExplanation(m),
    }))
  }
}

function generateFallbackExplanation(movie: MovieForExplanation): string {
  const reasons: string[] = []

  if (movie.similarity > 0.7) {
    reasons.push("strongly matches your viewing history")
  } else if (movie.similarity > 0.5) {
    reasons.push("aligns with your taste")
  }

  if (movie.novelty > 0.5) {
    reasons.push("introduces some fresh genres you might enjoy exploring")
  }

  if (movie.ratingScore > 0.7) {
    reasons.push("is highly acclaimed")
  }

  if (reasons.length === 0) {
    return `This ${movie.genres[0] || 'film'} offers something different from your usual picks.`
  }

  return `This ${movie.genres[0] || 'film'} ${reasons.join(' and ')}.`
}

/**
 * Store explanations in the database
 */
export async function storeExplanations(
  runId: string,
  explanations: ExplanationResult[]
): Promise<void> {
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

