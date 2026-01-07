import type { FastifyPluginAsync } from 'fastify'
import { streamText, tool } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'
import { getTextGenerationModel, getEmbeddingModel } from '@aperture/core'

// Types for database queries
interface MovieResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  poster_url: string | null
}

interface SeriesResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  network: string | null
  overview: string | null
  community_rating: number | null
  poster_url: string | null
}

interface TasteProfile {
  taste_synopsis: string | null
  series_taste_synopsis: string | null
}

interface RecentWatch {
  title: string
  year: number | null
  media_type: string
}

interface RecommendationResult {
  title: string
  year: number | null
  rank: number
  genres: string[]
  overview: string | null
}

// Get OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return createOpenAI({ apiKey })
}

// Build system prompt with user context
async function buildSystemPrompt(userId: string): Promise<string> {
  // Get user's taste profiles
  const tasteProfile = await queryOne<TasteProfile>(
    `SELECT taste_synopsis, series_taste_synopsis FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  // Get recent watches (last 10)
  const recentWatches = await query<RecentWatch>(
    `SELECT 
       COALESCE(m.title, s.title) as title,
       COALESCE(m.year, s.year) as year,
       wh.media_type
     FROM watch_history wh
     LEFT JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN series s ON s.id = wh.series_id
     WHERE wh.user_id = $1
     ORDER BY wh.last_watched_at DESC
     LIMIT 10`,
    [userId]
  )

  const movieTaste = tasteProfile?.taste_synopsis || 'No movie taste profile available yet.'
  const seriesTaste = tasteProfile?.series_taste_synopsis || 'No series taste profile available yet.'
  
  const recentList = recentWatches.rows.length > 0
    ? recentWatches.rows.map(w => `- ${w.title} (${w.year || 'N/A'}) [${w.media_type}]`).join('\n')
    : 'No recent watches recorded.'

  return `You are Aperture, an AI-powered movie and TV series recommendation assistant integrated into a personal media server. You help users discover content they'll love based on their viewing history and preferences.

## User's Taste Profile

**Movie Preferences:**
${movieTaste}

**TV Series Preferences:**
${seriesTaste}

## Recent Watches
${recentList}

## Your Capabilities

You can:
1. **Search** - Find movies or series by title, genre, or description
2. **Find Similar** - Discover content similar to something the user mentions using AI embeddings
3. **Get Recommendations** - Show the user's current personalized AI recommendations
4. **Explain Matches** - Explain why something would appeal to this user based on their taste

## Response Style

- Be warm, knowledgeable, and enthusiastic about media
- Keep responses concise but informative
- When recommending content, briefly explain WHY it fits the user's taste
- Use the tools provided to search the library rather than making up titles
- If asked about something not in the library, be honest about it
- Format lists nicely with titles, years, and brief descriptions

## Important Notes

- Only recommend content that exists in the user's media library
- Always use the search tools to verify content exists before recommending
- When finding similar content, use the getSimilarMovies or getSimilarSeries tools`
}

const assistantRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/assistant/chat
   * Streaming chat endpoint for the AI assistant
   */
  fastify.post<{
    Body: {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    }
  }>(
    '/api/assistant/chat',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { messages } = request.body
      const user = request.user as SessionUser

      if (!messages || !Array.isArray(messages)) {
        return reply.status(400).send({ error: 'Messages array is required' })
      }

      try {
        const openai = getOpenAIClient()
        const model = await getTextGenerationModel()
        const embeddingModel = await getEmbeddingModel()
        const systemPrompt = await buildSystemPrompt(user.id)

        // Define tools for the assistant
        const tools = {
          searchMovies: tool({
            description: 'Search for movies by title or genre. Use this to find specific movies or browse by genre.',
            parameters: z.object({
              query: z.string().optional().describe('Search query for movie title'),
              genre: z.string().optional().describe('Filter by genre (e.g., Action, Drama, Comedy)'),
              limit: z.number().optional().default(10).describe('Maximum number of results'),
            }),
            execute: async ({ query: searchQuery, genre, limit = 10 }) => {
              let whereClause = ''
              const params: unknown[] = []
              let paramIndex = 1

              if (searchQuery) {
                whereClause = `WHERE title ILIKE $${paramIndex++}`
                params.push(`%${searchQuery}%`)
              }

              if (genre) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `$${paramIndex++} = ANY(genres)`
                params.push(genre)
              }

              params.push(Math.min(limit, 20))

              const result = await query<MovieResult>(
                `SELECT id, title, year, genres, overview, community_rating, poster_url
                 FROM movies ${whereClause}
                 ORDER BY community_rating DESC NULLS LAST
                 LIMIT $${paramIndex}`,
                params
              )

              return result.rows.map(m => ({
                id: m.id,
                title: m.title,
                year: m.year,
                genres: m.genres,
                overview: m.overview?.substring(0, 200) + (m.overview && m.overview.length > 200 ? '...' : ''),
                rating: m.community_rating,
              }))
            },
          }),

          searchSeries: tool({
            description: 'Search for TV series by title, genre, or network. Use this to find specific shows.',
            parameters: z.object({
              query: z.string().optional().describe('Search query for series title'),
              genre: z.string().optional().describe('Filter by genre'),
              network: z.string().optional().describe('Filter by network (e.g., HBO, Netflix, AMC)'),
              limit: z.number().optional().default(10).describe('Maximum number of results'),
            }),
            execute: async ({ query: searchQuery, genre, network, limit = 10 }) => {
              let whereClause = ''
              const params: unknown[] = []
              let paramIndex = 1

              if (searchQuery) {
                whereClause = `WHERE title ILIKE $${paramIndex++}`
                params.push(`%${searchQuery}%`)
              }

              if (genre) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `$${paramIndex++} = ANY(genres)`
                params.push(genre)
              }

              if (network) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `network ILIKE $${paramIndex++}`
                params.push(`%${network}%`)
              }

              params.push(Math.min(limit, 20))

              const result = await query<SeriesResult>(
                `SELECT id, title, year, genres, network, overview, community_rating, poster_url
                 FROM series ${whereClause}
                 ORDER BY community_rating DESC NULLS LAST
                 LIMIT $${paramIndex}`,
                params
              )

              return result.rows.map(s => ({
                id: s.id,
                title: s.title,
                year: s.year,
                genres: s.genres,
                network: s.network,
                overview: s.overview?.substring(0, 200) + (s.overview && s.overview.length > 200 ? '...' : ''),
                rating: s.community_rating,
              }))
            },
          }),

          getSimilarMovies: tool({
            description: 'Find movies similar to a given movie using AI embeddings. Great for "find me something like X" requests.',
            parameters: z.object({
              movieTitle: z.string().describe('The title of the movie to find similar content for'),
              limit: z.number().optional().default(5).describe('Number of similar movies to return'),
            }),
            execute: async ({ movieTitle, limit = 5 }) => {
              // First find the movie
              const movie = await queryOne<{ id: string; title: string }>(
                `SELECT id, title FROM movies WHERE title ILIKE $1 LIMIT 1`,
                [`%${movieTitle}%`]
              )

              if (!movie) {
                return { error: `Movie "${movieTitle}" not found in library` }
              }

              // Get its embedding
              const embedding = await queryOne<{ embedding: string }>(
                `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
                [movie.id, embeddingModel]
              )

              if (!embedding) {
                return { error: `No embedding found for "${movie.title}"` }
              }

              // Find similar movies
              const similar = await query<MovieResult>(
                `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating, m.poster_url,
                        1 - (e.embedding <=> $1::halfvec) as similarity
                 FROM embeddings e
                 JOIN movies m ON m.id = e.movie_id
                 WHERE e.movie_id != $2 AND e.model = $3
                 ORDER BY e.embedding <=> $1::halfvec
                 LIMIT $4`,
                [embedding.embedding, movie.id, embeddingModel, limit]
              )

              return {
                basedOn: movie.title,
                similar: similar.rows.map(m => ({
                  title: m.title,
                  year: m.year,
                  genres: m.genres,
                  overview: m.overview?.substring(0, 150) + '...',
                  rating: m.community_rating,
                })),
              }
            },
          }),

          getSimilarSeries: tool({
            description: 'Find TV series similar to a given show using AI embeddings.',
            parameters: z.object({
              seriesTitle: z.string().describe('The title of the series to find similar content for'),
              limit: z.number().optional().default(5).describe('Number of similar series to return'),
            }),
            execute: async ({ seriesTitle, limit = 5 }) => {
              // First find the series
              const series = await queryOne<{ id: string; title: string }>(
                `SELECT id, title FROM series WHERE title ILIKE $1 LIMIT 1`,
                [`%${seriesTitle}%`]
              )

              if (!series) {
                return { error: `Series "${seriesTitle}" not found in library` }
              }

              // Get its embedding
              const embedding = await queryOne<{ embedding: string }>(
                `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
                [series.id, embeddingModel]
              )

              if (!embedding) {
                return { error: `No embedding found for "${series.title}"` }
              }

              // Find similar series
              const similar = await query<SeriesResult>(
                `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating, s.poster_url,
                        1 - (se.embedding <=> $1::halfvec) as similarity
                 FROM series_embeddings se
                 JOIN series s ON s.id = se.series_id
                 WHERE se.series_id != $2 AND se.model = $3
                 ORDER BY se.embedding <=> $1::halfvec
                 LIMIT $4`,
                [embedding.embedding, series.id, embeddingModel, limit]
              )

              return {
                basedOn: series.title,
                similar: similar.rows.map(s => ({
                  title: s.title,
                  year: s.year,
                  genres: s.genres,
                  network: s.network,
                  overview: s.overview?.substring(0, 150) + '...',
                  rating: s.community_rating,
                })),
              }
            },
          }),

          getMyRecommendations: tool({
            description: 'Get the user\'s current AI-generated personalized recommendations.',
            parameters: z.object({
              type: z.enum(['movies', 'series', 'both']).default('both').describe('Type of recommendations to fetch'),
              limit: z.number().optional().default(10).describe('Number of recommendations to return'),
            }),
            execute: async ({ type, limit = 10 }) => {
              const result: { movies?: RecommendationResult[]; series?: RecommendationResult[] } = {}

              if (type === 'movies' || type === 'both') {
                const movieRecs = await query<RecommendationResult>(
                  `SELECT m.title, m.year, rc.selected_rank as rank, m.genres, m.overview
                   FROM recommendation_candidates rc
                   JOIN recommendation_runs rr ON rr.id = rc.run_id
                   JOIN movies m ON m.id = rc.movie_id
                   WHERE rr.user_id = $1 
                     AND rr.status = 'completed' 
                     AND rr.media_type = 'movie'
                     AND rc.is_selected = true
                   ORDER BY rr.created_at DESC, rc.selected_rank ASC
                   LIMIT $2`,
                  [user.id, limit]
                )
                result.movies = movieRecs.rows.map(r => ({
                  ...r,
                  overview: r.overview?.substring(0, 150) + '...',
                }))
              }

              if (type === 'series' || type === 'both') {
                const seriesRecs = await query<RecommendationResult>(
                  `SELECT s.title, s.year, rc.selected_rank as rank, s.genres, s.overview
                   FROM recommendation_candidates rc
                   JOIN recommendation_runs rr ON rr.id = rc.run_id
                   JOIN series s ON s.id = rc.series_id
                   WHERE rr.user_id = $1 
                     AND rr.status = 'completed' 
                     AND rr.media_type = 'series'
                     AND rc.is_selected = true
                   ORDER BY rr.created_at DESC, rc.selected_rank ASC
                   LIMIT $2`,
                  [user.id, limit]
                )
                result.series = seriesRecs.rows.map(r => ({
                  ...r,
                  overview: r.overview?.substring(0, 150) + '...',
                }))
              }

              if ((!result.movies || result.movies.length === 0) && (!result.series || result.series.length === 0)) {
                return { message: 'No recommendations generated yet. Ask an admin to run the recommendation job.' }
              }

              return result
            },
          }),

          getAvailableGenres: tool({
            description: 'Get a list of all available genres in the library.',
            parameters: z.object({
              type: z.enum(['movies', 'series', 'both']).default('both').describe('Type of content to get genres for'),
            }),
            execute: async ({ type }) => {
              const genres: { movies?: string[]; series?: string[] } = {}

              if (type === 'movies' || type === 'both') {
                const movieGenres = await query<{ genre: string }>(
                  `SELECT DISTINCT unnest(genres) as genre FROM movies ORDER BY genre`
                )
                genres.movies = movieGenres.rows.map(g => g.genre)
              }

              if (type === 'series' || type === 'both') {
                const seriesGenres = await query<{ genre: string }>(
                  `SELECT DISTINCT unnest(genres) as genre FROM series ORDER BY genre`
                )
                genres.series = seriesGenres.rows.map(g => g.genre)
              }

              return genres
            },
          }),
        }

        // Create the streaming response
        const result = streamText({
          model: openai(model),
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          tools,
          maxSteps: 5, // Allow multiple tool calls
        })

        // Set headers for SSE
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        // Stream the response
        const stream = result.toDataStream()
        const reader = stream.getReader()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            reply.raw.write(value)
          }
        } finally {
          reader.releaseLock()
          reply.raw.end()
        }

        return reply
      } catch (err) {
        fastify.log.error({ err }, 'Assistant chat error')
        
        // If headers already sent, we can't send a proper error response
        if (reply.raw.headersSent) {
          reply.raw.end()
          return
        }
        
        return reply.status(500).send({ 
          error: 'Failed to process chat request',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  )
}

export default assistantRoutes

