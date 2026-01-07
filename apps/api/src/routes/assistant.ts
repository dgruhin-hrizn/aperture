import type { FastifyPluginAsync } from 'fastify'
import { streamText, tool } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'
import {
  getTextGenerationModel,
  getEmbeddingModel,
  getMediaServerConfig,
  createMediaServerProvider,
} from '@aperture/core'

// Types for database queries
interface MovieResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  poster_url: string | null
  provider_item_id?: string | null
  runtime?: number | null
  director?: string | null
  cast?: string[] | null
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
  provider_item_id?: string | null
  status?: string | null
  end_year?: number | null
}

// Media server info for generating play links
interface MediaServerInfo {
  baseUrl: string
  type: 'emby' | 'jellyfin'
  serverId: string
}

// Helper to get media server info for play links
async function getMediaServerInfo(): Promise<MediaServerInfo | null> {
  try {
    const config = await getMediaServerConfig()
    if (!config.baseUrl || !config.apiKey || !config.type) return null

    let serverId = ''
    try {
      const provider = createMediaServerProvider(config.type, config.baseUrl)
      if ('getServerInfo' in provider) {
        const info = await (
          provider as { getServerInfo: (key: string) => Promise<{ id: string; name: string }> }
        ).getServerInfo(config.apiKey)
        serverId = info.id
      }
    } catch {
      // Server ID is optional for link generation
    }

    return {
      baseUrl: config.baseUrl,
      type: config.type as 'emby' | 'jellyfin',
      serverId,
    }
  } catch {
    return null
  }
}

// Helper to build play link for content
function buildPlayLink(
  mediaServer: MediaServerInfo | null,
  providerItemId: string | null | undefined,
  type: 'movie' | 'series'
): string | null {
  if (!mediaServer?.baseUrl || !providerItemId) return null

  const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
  const itemPath =
    mediaServer.type === 'jellyfin'
      ? `#!/details?id=${providerItemId}${serverIdParam}`
      : `#!/item?id=${providerItemId}${serverIdParam}`

  return `${mediaServer.baseUrl}/web/index.html${itemPath}`
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
async function buildSystemPrompt(userId: string, isAdmin: boolean): Promise<string> {
  // Get user's taste profiles
  const tasteProfile = await queryOne<TasteProfile>(
    `SELECT taste_synopsis, series_taste_synopsis FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  // Get recent watches (last 10) - movies and episodes
  const recentWatches = await query<RecentWatch>(
    `SELECT 
       COALESCE(m.title, s.title) as title,
       COALESCE(m.year, s.year) as year,
       wh.media_type
     FROM watch_history wh
     LEFT JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN episodes e ON e.id = wh.episode_id
     LEFT JOIN series s ON s.id = e.series_id
     WHERE wh.user_id = $1
     ORDER BY wh.last_played_at DESC NULLS LAST
     LIMIT 10`,
    [userId]
  )

  const movieTaste = tasteProfile?.taste_synopsis || 'No movie taste profile available yet.'
  const seriesTaste =
    tasteProfile?.series_taste_synopsis || 'No series taste profile available yet.'

  const recentList =
    recentWatches.rows.length > 0
      ? recentWatches.rows
          .map((w) => `- ${w.title} (${w.year || 'N/A'}) [${w.media_type}]`)
          .join('\n')
      : 'No recent watches recorded.'

  const userRole = isAdmin ? 'ADMINISTRATOR' : 'USER'
  const adminSection = isAdmin
    ? `
## Admin Capabilities (You are an admin!)

As an admin, you can help with:
- **Job Management**: Explain how to run sync jobs, generate recommendations, create embeddings
- **Algorithm Tuning**: Explain similarity, novelty, rating, and diversity weights
- **User Management**: Explain how to enable/disable users for recommendations
- **Top Picks Configuration**: Explain popularity algorithm, output types (library/collection/playlist)
- **Model Selection**: Explain embedding models (text-embedding-3-small vs large) and text models
- **STRM vs Symlinks**: Explain when to use each output format
- **Library Images**: Explain how to upload custom 16:9 banners for libraries

When asked about admin tasks, provide step-by-step instructions referencing the Admin section in Settings.
`
    : ''

  return `You are Aperture, an AI-powered movie and TV series recommendation assistant integrated into a personal media server. You have FULL ACCESS to the user's complete media library database including movies, series, cast, crew, studios, watch history, ratings, and more.

## Current User
- **Role**: ${userRole}
- **Movie Taste**: ${movieTaste}
- **TV Taste**: ${seriesTaste}

## Recent Watches
${recentList}
${adminSection}
## What You Can Do

### Content Discovery
- **Search**: Find movies/series by title, genre, year, director, actor, studio
- **Similar Content**: Use AI embeddings to find content like something the user mentions
- **Browse People**: Search for actors, directors - show their filmography and images
- **Studio Info**: Show studio details and their productions
- **Recommendations**: Show personalized AI-generated picks

### User Data
- **Watch History**: What they've watched, play counts, when
- **Ratings**: What they've rated and their scores
- **Watch Stats**: Genre breakdowns, top actors/directors/studios

### Actions
- **Play Links**: Provide direct Emby/Jellyfin links to play content
- **Content Details**: Full metadata including cast, crew, runtime, ratings

## CRITICAL TOOL USAGE RULES

1. **ALWAYS use tools** - Never guess or make up information. Query the database.
2. **Include images** - When showing content, include poster URLs. When showing people, include their thumbnail.
3. **Include play links** - Always include Emby/Jellyfin play links when showing content.
4. **Search smart** - findSimilarContent works for BOTH movies AND series automatically.

## Tool Selection Examples

| User Says | Use Tool |
|-----------|----------|
| "find something like Inception" | findSimilarContent(title: "Inception") |
| "how many movies do I have" | getLibraryStats() |
| "show me sci-fi movies" | searchContent(genre: "Science Fiction") |
| "movies with Tom Hanks" | searchPeople(name: "Tom Hanks") then show their movies |
| "tell me about Inception" | getContentDetails(title: "Inception") |
| "play Nobody Wants This" | getContentDetails → provide playLink |
| "what studios do I watch most" | getTopStudios() |
| "help me use Aperture" | getSystemHelp() |

## Response Formatting

### When showing content, use this format:
**Title** (Year) ⭐ Rating/10
![Poster](poster_url)
Genre1, Genre2 | Runtime | Network/Studio
> Brief overview...
[▶️ Play on Emby](play_link)

### When showing people:
**Name** (Actor/Director)
![Photo](thumb_url)
Known for: Movie1, Movie2, Movie3
Appearances in your library: X movies, Y series

### When showing studios:
**Studio Name**
Productions in library: X movies, Y series
Top titles: Movie1, Movie2

## Important Rules

- You have COMPLETE database access - never say "I don't have access"
- ALWAYS include poster images when discussing content
- ALWAYS include play links when available
- Be warm, knowledgeable, and enthusiastic about media
- If asked about something not in the library, be honest and suggest alternatives
- Use emoji sparingly: 🎬 🎭 ⭐ 📺 ▶️`
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
  }>('/api/assistant/chat', { preHandler: requireAuth }, async (request, reply) => {
    const { messages } = request.body
    const user = request.user as SessionUser

    if (!messages || !Array.isArray(messages)) {
      return reply.status(400).send({ error: 'Messages array is required' })
    }

    try {
      const openai = getOpenAIClient()
      const model = await getTextGenerationModel()
      const embeddingModel = await getEmbeddingModel()
      const systemPrompt = await buildSystemPrompt(user.id, user.isAdmin)

      // Define tools for the assistant
      const tools = {
        // ============================================
        // LIBRARY STATS - For counting and overview questions
        // ============================================
        getLibraryStats: tool({
          description:
            'Get comprehensive statistics about the user\'s media library. Use this for ANY question about counts, totals, or library overview (e.g., "how many movies", "library size", "what do I have").',
          parameters: z.object({}),
          execute: async () => {
            // Get movie stats
            const movieStats = await queryOne<{
              count: string
              avg_rating: number
              total_runtime: string
            }>(
              `SELECT 
                   COUNT(*) as count,
                   ROUND(AVG(community_rating)::numeric, 2) as avg_rating,
                   SUM(runtime) as total_runtime
                 FROM movies`
            )

            // Get series stats
            const seriesStats = await queryOne<{
              count: string
              episode_count: string
              avg_rating: number
            }>(
              `SELECT 
                   COUNT(DISTINCT s.id) as count,
                   COUNT(e.id) as episode_count,
                   ROUND(AVG(s.community_rating)::numeric, 2) as avg_rating
                 FROM series s
                 LEFT JOIN seasons sea ON sea.series_id = s.id
                 LEFT JOIN episodes e ON e.season_id = sea.id`
            )

            // Get genre breakdown for movies
            const movieGenres = await query<{ genre: string; count: string }>(
              `SELECT unnest(genres) as genre, COUNT(*) as count
                 FROM movies
                 GROUP BY genre
                 ORDER BY count DESC
                 LIMIT 10`
            )

            // Get genre breakdown for series
            const seriesGenres = await query<{ genre: string; count: string }>(
              `SELECT unnest(genres) as genre, COUNT(*) as count
                 FROM series
                 GROUP BY genre
                 ORDER BY count DESC
                 LIMIT 10`
            )

            // Get user's watch stats
            const watchStats = await queryOne<{
              movies_watched: string
              episodes_watched: string
              total_plays: string
            }>(
              `SELECT 
                   COUNT(DISTINCT movie_id) FILTER (WHERE movie_id IS NOT NULL) as movies_watched,
                   COUNT(DISTINCT episode_id) FILTER (WHERE episode_id IS NOT NULL) as episodes_watched,
                   SUM(play_count) as total_plays
                 FROM watch_history
                 WHERE user_id = $1`,
              [user.id]
            )

            // Get ratings stats
            const ratingStats = await queryOne<{ total_ratings: string; avg_rating: number }>(
              `SELECT COUNT(*) as total_ratings, ROUND(AVG(rating)::numeric, 1) as avg_rating
                 FROM user_ratings
                 WHERE user_id = $1`,
              [user.id]
            )

            const totalRuntime = parseInt(movieStats?.total_runtime || '0')
            const days = Math.floor(totalRuntime / 60 / 24)
            const hours = Math.floor((totalRuntime / 60) % 24)

            return {
              movies: {
                total: parseInt(movieStats?.count || '0'),
                averageRating: movieStats?.avg_rating || 0,
                totalRuntime: `${days} days, ${hours} hours`,
                topGenres: movieGenres.rows.map((g) => ({
                  genre: g.genre,
                  count: parseInt(g.count),
                })),
              },
              series: {
                total: parseInt(seriesStats?.count || '0'),
                totalEpisodes: parseInt(seriesStats?.episode_count || '0'),
                averageRating: seriesStats?.avg_rating || 0,
                topGenres: seriesGenres.rows.map((g) => ({
                  genre: g.genre,
                  count: parseInt(g.count),
                })),
              },
              userActivity: {
                moviesWatched: parseInt(watchStats?.movies_watched || '0'),
                episodesWatched: parseInt(watchStats?.episodes_watched || '0'),
                totalPlays: parseInt(watchStats?.total_plays || '0'),
                totalRatings: parseInt(ratingStats?.total_ratings || '0'),
                averageRating: ratingStats?.avg_rating || 0,
              },
            }
          },
        }),

        // ============================================
        // UNIFIED SEARCH - Searches both movies AND series
        // ============================================
        searchContent: tool({
          description:
            'Search for movies and/or TV series by title, genre, year, or other criteria. This is the PRIMARY search tool - use it for finding specific content or browsing.',
          parameters: z.object({
            query: z
              .string()
              .optional()
              .describe('Search query - matches title, overview, cast, director'),
            genre: z
              .string()
              .optional()
              .describe('Filter by genre (e.g., Action, Drama, Comedy, Science Fiction, Horror)'),
            year: z.number().optional().describe('Filter by release year'),
            minRating: z.number().optional().describe('Minimum community rating (0-10)'),
            type: z
              .enum(['movies', 'series', 'both'])
              .optional()
              .default('both')
              .describe('Type of content to search'),
            limit: z.number().optional().default(10).describe('Maximum number of results per type'),
          }),
          execute: async ({
            query: searchQuery,
            genre,
            year,
            minRating,
            type = 'both',
            limit = 10,
          }) => {
            const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}
            const safeLimit = Math.min(limit, 20)

            if (type === 'movies' || type === 'both') {
              let whereClause = ''
              const params: unknown[] = []
              let paramIndex = 1

              if (searchQuery) {
                whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex} OR $${paramIndex} = ANY(cast) OR $${paramIndex} ILIKE director)`
                params.push(`%${searchQuery}%`)
                paramIndex++
              }

              if (genre) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `$${paramIndex} = ANY(genres)`
                params.push(genre)
                paramIndex++
              }

              if (year) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `year = $${paramIndex}`
                params.push(year)
                paramIndex++
              }

              if (minRating) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `community_rating >= $${paramIndex}`
                params.push(minRating)
                paramIndex++
              }

              params.push(safeLimit)

              const movieResult = await query<MovieResult>(
                `SELECT id, title, year, genres, overview, community_rating, poster_url
                   FROM movies ${whereClause}
                   ORDER BY community_rating DESC NULLS LAST
                   LIMIT $${paramIndex}`,
                params
              )

              results.movies = movieResult.rows.map((m) => ({
                ...m,
                overview:
                  m.overview?.substring(0, 200) +
                  (m.overview && m.overview.length > 200 ? '...' : ''),
              }))
            }

            if (type === 'series' || type === 'both') {
              let whereClause = ''
              const params: unknown[] = []
              let paramIndex = 1

              if (searchQuery) {
                whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex})`
                params.push(`%${searchQuery}%`)
                paramIndex++
              }

              if (genre) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `$${paramIndex} = ANY(genres)`
                params.push(genre)
                paramIndex++
              }

              if (year) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `year = $${paramIndex}`
                params.push(year)
                paramIndex++
              }

              if (minRating) {
                whereClause += whereClause ? ' AND ' : 'WHERE '
                whereClause += `community_rating >= $${paramIndex}`
                params.push(minRating)
                paramIndex++
              }

              params.push(safeLimit)

              const seriesResult = await query<SeriesResult>(
                `SELECT id, title, year, genres, network, overview, community_rating, poster_url
                   FROM series ${whereClause}
                   ORDER BY community_rating DESC NULLS LAST
                   LIMIT $${paramIndex}`,
                params
              )

              results.series = seriesResult.rows.map((s) => ({
                ...s,
                overview:
                  s.overview?.substring(0, 200) +
                  (s.overview && s.overview.length > 200 ? '...' : ''),
              }))
            }

            const totalFound = (results.movies?.length || 0) + (results.series?.length || 0)
            if (totalFound === 0) {
              return {
                message: 'No results found. Try a different search term or browse by genre.',
              }
            }

            return results
          },
        }),

        // ============================================
        // FIND SIMILAR - Smart similarity search
        // ============================================
        findSimilarContent: tool({
          description:
            'Find movies and TV series similar to a given title using AI embeddings. Use this for "find me something like X", "similar to X", "movies like X" requests. Automatically searches both movies AND series.',
          parameters: z.object({
            title: z
              .string()
              .describe(
                'The title to find similar content for (e.g., "Inception", "Breaking Bad")'
              ),
            limit: z.number().optional().default(5).describe('Number of similar items to return'),
          }),
          execute: async ({ title, limit = 5 }) => {
            const results: {
              foundAs?: string
              foundType?: string
              similarMovies?: Array<{
                title: string
                year: number | null
                genres: string[]
                rating: number | null
                overview: string | null
              }>
              similarSeries?: Array<{
                title: string
                year: number | null
                genres: string[]
                network: string | null
                rating: number | null
                overview: string | null
              }>
              error?: string
            } = {}

            // Try to find as movie first
            const movie = await queryOne<{ id: string; title: string }>(
              `SELECT id, title FROM movies WHERE title ILIKE $1 LIMIT 1`,
              [`%${title}%`]
            )

            // Also try to find as series
            const series = await queryOne<{ id: string; title: string }>(
              `SELECT id, title FROM series WHERE title ILIKE $1 LIMIT 1`,
              [`%${title}%`]
            )

            if (!movie && !series) {
              return {
                error: `"${title}" not found in your library. Try searching for it first to see available titles.`,
              }
            }

            // If found as movie, get similar movies
            if (movie) {
              results.foundAs = movie.title
              results.foundType = 'movie'

              const embedding = await queryOne<{ embedding: string }>(
                `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
                [movie.id, embeddingModel]
              )

              if (embedding) {
                const similar = await query<MovieResult>(
                  `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating
                     FROM embeddings e
                     JOIN movies m ON m.id = e.movie_id
                     WHERE e.movie_id != $1 AND e.model = $2
                     ORDER BY e.embedding <=> $3::halfvec
                     LIMIT $4`,
                  [movie.id, embeddingModel, embedding.embedding, limit]
                )

                results.similarMovies = similar.rows.map((m) => ({
                  title: m.title,
                  year: m.year,
                  genres: m.genres,
                  rating: m.community_rating,
                  overview: m.overview?.substring(0, 150) + '...',
                }))
              }
            }

            // If found as series, get similar series
            if (series) {
              if (!results.foundAs) {
                results.foundAs = series.title
                results.foundType = 'series'
              }

              const embedding = await queryOne<{ embedding: string }>(
                `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
                [series.id, embeddingModel]
              )

              if (embedding) {
                const similar = await query<SeriesResult>(
                  `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating
                     FROM series_embeddings se
                     JOIN series s ON s.id = se.series_id
                     WHERE se.series_id != $1 AND se.model = $2
                     ORDER BY se.embedding <=> $3::halfvec
                     LIMIT $4`,
                  [series.id, embeddingModel, embedding.embedding, limit]
                )

                results.similarSeries = similar.rows.map((s) => ({
                  title: s.title,
                  year: s.year,
                  genres: s.genres,
                  network: s.network,
                  rating: s.community_rating,
                  overview: s.overview?.substring(0, 150) + '...',
                }))
              }
            }

            return results
          },
        }),

        // ============================================
        // WATCH HISTORY - User's viewing history
        // ============================================
        getWatchHistory: tool({
          description:
            'Get the user\'s watch history. Use for "what have I watched", "my history", "recently watched" questions.',
          parameters: z.object({
            type: z
              .enum(['movies', 'series', 'both'])
              .optional()
              .default('both')
              .describe('Type of content'),
            limit: z.number().optional().default(20).describe('Number of items to return'),
          }),
          execute: async ({ type = 'both', limit = 20 }) => {
            const results: {
              movies?: Array<{
                title: string
                year: number | null
                lastWatched: Date
                playCount: number
              }>
              series?: Array<{
                title: string
                year: number | null
                episodesWatched: number
                lastWatched: Date
              }>
            } = {}

            if (type === 'movies' || type === 'both') {
              const movieHistory = await query<{
                title: string
                year: number | null
                last_played_at: Date
                play_count: number
              }>(
                `SELECT m.title, m.year, wh.last_played_at, wh.play_count
                   FROM watch_history wh
                   JOIN movies m ON m.id = wh.movie_id
                   WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
                   ORDER BY wh.last_played_at DESC
                   LIMIT $2`,
                [user.id, limit]
              )
              results.movies = movieHistory.rows.map((m) => ({
                title: m.title,
                year: m.year,
                lastWatched: m.last_played_at,
                playCount: m.play_count,
              }))
            }

            if (type === 'series' || type === 'both') {
              const seriesHistory = await query<{
                title: string
                year: number | null
                episodes_watched: string
                last_watched: Date
              }>(
                `SELECT s.title, s.year, 
                          COUNT(DISTINCT wh.episode_id) as episodes_watched,
                          MAX(wh.last_played_at) as last_watched
                   FROM watch_history wh
                   JOIN episodes e ON e.id = wh.episode_id
                   JOIN seasons sea ON sea.id = e.season_id
                   JOIN series s ON s.id = sea.series_id
                   WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL
                   GROUP BY s.id, s.title, s.year
                   ORDER BY last_watched DESC
                   LIMIT $2`,
                [user.id, limit]
              )
              results.series = seriesHistory.rows.map((s) => ({
                title: s.title,
                year: s.year,
                episodesWatched: parseInt(s.episodes_watched),
                lastWatched: s.last_watched,
              }))
            }

            return results
          },
        }),

        // ============================================
        // USER RATINGS - What the user has rated
        // ============================================
        getUserRatings: tool({
          description:
            'Get the user\'s ratings. Use for "what have I rated", "my ratings", "what did I like/dislike" questions.',
          parameters: z.object({
            minRating: z.number().optional().describe('Minimum rating to filter (1-10)'),
            maxRating: z.number().optional().describe('Maximum rating to filter (1-10)'),
            limit: z.number().optional().default(20).describe('Number of items to return'),
          }),
          execute: async ({ minRating, maxRating, limit = 20 }) => {
            let whereClause = 'WHERE ur.user_id = $1'
            const params: unknown[] = [user.id]
            let paramIndex = 2

            if (minRating !== undefined) {
              whereClause += ` AND ur.rating >= $${paramIndex}`
              params.push(minRating)
              paramIndex++
            }

            if (maxRating !== undefined) {
              whereClause += ` AND ur.rating <= $${paramIndex}`
              params.push(maxRating)
              paramIndex++
            }

            params.push(limit)

            // Get movie ratings
            const movieRatings = await query<{
              title: string
              year: number | null
              rating: number
              rated_at: Date
            }>(
              `SELECT m.title, m.year, ur.rating, ur.updated_at as rated_at
                 FROM user_ratings ur
                 JOIN movies m ON m.id = ur.movie_id
                 ${whereClause} AND ur.movie_id IS NOT NULL
                 ORDER BY ur.rating DESC, ur.updated_at DESC
                 LIMIT $${paramIndex}`,
              params
            )

            // Get series ratings
            const seriesRatings = await query<{
              title: string
              year: number | null
              rating: number
              rated_at: Date
            }>(
              `SELECT s.title, s.year, ur.rating, ur.updated_at as rated_at
                 FROM user_ratings ur
                 JOIN series s ON s.id = ur.series_id
                 ${whereClause} AND ur.series_id IS NOT NULL
                 ORDER BY ur.rating DESC, ur.updated_at DESC
                 LIMIT $${paramIndex}`,
              params
            )

            return {
              movies: movieRatings.rows.map((r) => ({
                title: r.title,
                year: r.year,
                rating: r.rating,
                ratedAt: r.rated_at,
              })),
              series: seriesRatings.rows.map((r) => ({
                title: r.title,
                year: r.year,
                rating: r.rating,
                ratedAt: r.rated_at,
              })),
            }
          },
        }),

        // ============================================
        // RECOMMENDATIONS - AI-generated picks
        // ============================================
        getMyRecommendations: tool({
          description: "Get the user's current AI-generated personalized recommendations.",
          parameters: z.object({
            type: z
              .enum(['movies', 'series', 'both'])
              .default('both')
              .describe('Type of recommendations'),
            limit: z.number().optional().default(10).describe('Number of recommendations'),
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
              result.movies = movieRecs.rows.map((r) => ({
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
              result.series = seriesRecs.rows.map((r) => ({
                ...r,
                overview: r.overview?.substring(0, 150) + '...',
              }))
            }

            if (
              (!result.movies || result.movies.length === 0) &&
              (!result.series || result.series.length === 0)
            ) {
              return {
                message:
                  'No recommendations generated yet. Ask an admin to run the recommendation job.',
              }
            }

            return result
          },
        }),

        // ============================================
        // GENRES - Available genres
        // ============================================
        getAvailableGenres: tool({
          description: 'Get a list of all available genres in the library with counts.',
          parameters: z.object({
            type: z.enum(['movies', 'series', 'both']).default('both').describe('Type of content'),
          }),
          execute: async ({ type }) => {
            const genres: {
              movies?: Array<{ genre: string; count: number }>
              series?: Array<{ genre: string; count: number }>
            } = {}

            if (type === 'movies' || type === 'both') {
              const movieGenres = await query<{ genre: string; count: string }>(
                `SELECT unnest(genres) as genre, COUNT(*) as count 
                   FROM movies 
                   GROUP BY genre 
                   ORDER BY count DESC`
              )
              genres.movies = movieGenres.rows.map((g) => ({
                genre: g.genre,
                count: parseInt(g.count),
              }))
            }

            if (type === 'series' || type === 'both') {
              const seriesGenres = await query<{ genre: string; count: string }>(
                `SELECT unnest(genres) as genre, COUNT(*) as count 
                   FROM series 
                   GROUP BY genre 
                   ORDER BY count DESC`
              )
              genres.series = seriesGenres.rows.map((g) => ({
                genre: g.genre,
                count: parseInt(g.count),
              }))
            }

            return genres
          },
        }),

        // ============================================
        // TOP RATED - Best content in library
        // ============================================
        getTopRated: tool({
          description:
            'Get the highest-rated content in the library. Use for "best movies", "top rated", "highest rated" questions.',
          parameters: z.object({
            type: z.enum(['movies', 'series', 'both']).default('both').describe('Type of content'),
            genre: z.string().optional().describe('Filter by genre'),
            limit: z.number().optional().default(10).describe('Number of items'),
          }),
          execute: async ({ type, genre, limit = 10 }) => {
            const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}

            if (type === 'movies' || type === 'both') {
              let whereClause = 'WHERE community_rating IS NOT NULL'
              const params: unknown[] = []
              let paramIndex = 1

              if (genre) {
                whereClause += ` AND $${paramIndex} = ANY(genres)`
                params.push(genre)
                paramIndex++
              }

              params.push(limit)

              const movies = await query<MovieResult>(
                `SELECT id, title, year, genres, overview, community_rating
                   FROM movies ${whereClause}
                   ORDER BY community_rating DESC
                   LIMIT $${paramIndex}`,
                params
              )
              results.movies = movies.rows
            }

            if (type === 'series' || type === 'both') {
              let whereClause = 'WHERE community_rating IS NOT NULL'
              const params: unknown[] = []
              let paramIndex = 1

              if (genre) {
                whereClause += ` AND $${paramIndex} = ANY(genres)`
                params.push(genre)
                paramIndex++
              }

              params.push(limit)

              const series = await query<SeriesResult>(
                `SELECT id, title, year, genres, network, overview, community_rating
                   FROM series ${whereClause}
                   ORDER BY community_rating DESC
                   LIMIT $${paramIndex}`,
                params
              )
              results.series = series.rows
            }

            return results
          },
        }),

        // ============================================
        // UNWATCHED - Content user hasn't seen
        // ============================================
        getUnwatched: tool({
          description:
            'Get content the user has NOT watched yet. Great for "what should I watch", "something new", "unwatched" questions.',
          parameters: z.object({
            type: z.enum(['movies', 'series', 'both']).default('both').describe('Type of content'),
            genre: z.string().optional().describe('Filter by genre'),
            minRating: z.number().optional().describe('Minimum community rating'),
            limit: z.number().optional().default(10).describe('Number of items'),
          }),
          execute: async ({ type, genre, minRating, limit = 10 }) => {
            const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}

            if (type === 'movies' || type === 'both') {
              let whereClause = `WHERE m.id NOT IN (
                  SELECT movie_id FROM watch_history WHERE user_id = $1 AND movie_id IS NOT NULL
                )`
              const params: unknown[] = [user.id]
              let paramIndex = 2

              if (genre) {
                whereClause += ` AND $${paramIndex} = ANY(m.genres)`
                params.push(genre)
                paramIndex++
              }

              if (minRating) {
                whereClause += ` AND m.community_rating >= $${paramIndex}`
                params.push(minRating)
                paramIndex++
              }

              params.push(limit)

              const movies = await query<MovieResult>(
                `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating
                   FROM movies m
                   ${whereClause}
                   ORDER BY m.community_rating DESC NULLS LAST
                   LIMIT $${paramIndex}`,
                params
              )
              results.movies = movies.rows.map((m) => ({
                ...m,
                overview: m.overview?.substring(0, 150) + '...',
              }))
            }

            if (type === 'series' || type === 'both') {
              let whereClause = `WHERE s.id NOT IN (
                  SELECT DISTINCT sea.series_id 
                  FROM watch_history wh
                  JOIN episodes e ON e.id = wh.episode_id
                  JOIN seasons sea ON sea.id = e.season_id
                  WHERE wh.user_id = $1
                )`
              const params: unknown[] = [user.id]
              let paramIndex = 2

              if (genre) {
                whereClause += ` AND $${paramIndex} = ANY(s.genres)`
                params.push(genre)
                paramIndex++
              }

              if (minRating) {
                whereClause += ` AND s.community_rating >= $${paramIndex}`
                params.push(minRating)
                paramIndex++
              }

              params.push(limit)

              const series = await query<SeriesResult>(
                `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating
                   FROM series s
                   ${whereClause}
                   ORDER BY s.community_rating DESC NULLS LAST
                   LIMIT $${paramIndex}`,
                params
              )
              results.series = series.rows.map((s) => ({
                ...s,
                overview: s.overview?.substring(0, 150) + '...',
              }))
            }

            return results
          },
        }),

        // ============================================
        // GET CONTENT DETAILS - Full info with play links
        // ============================================
        getContentDetails: tool({
          description:
            'Get comprehensive details about a specific movie or TV series including Emby/Jellyfin play link, all metadata, cast, and more. Use this for "tell me about X", "everything about X", "play X", "link to X", "what is the Emby ID for X" questions.',
          parameters: z.object({
            title: z.string().describe('The title of the movie or series to get details for'),
          }),
          execute: async ({ title }) => {
            // Get media server info for generating play links
            const mediaServer = await getMediaServerInfo()

            // Try to find as movie first
            const movie = await queryOne<{
              id: string
              title: string
              year: number | null
              genres: string[]
              overview: string | null
              community_rating: number | null
              poster_url: string | null
              provider_item_id: string | null
              runtime: number | null
              director: string | null
              cast: string[] | null
              tagline: string | null
              release_date: string | null
              content_rating: string | null
              critic_rating: number | null
            }>(
              `SELECT id, title, year, genres, overview, community_rating, poster_url,
                      provider_item_id, runtime, director, cast, tagline, 
                      release_date, content_rating, critic_rating
               FROM movies 
               WHERE title ILIKE $1 
               LIMIT 1`,
              [`%${title}%`]
            )

            if (movie) {
              const playLink = buildPlayLink(mediaServer, movie.provider_item_id, 'movie')
              const runtimeHours = movie.runtime ? Math.floor(movie.runtime / 60) : 0
              const runtimeMins = movie.runtime ? movie.runtime % 60 : 0

              // Get user's rating if any
              const userRating = await queryOne<{ rating: number }>(
                `SELECT rating FROM user_ratings WHERE user_id = $1 AND movie_id = $2`,
                [user.id, movie.id]
              )

              // Check if watched
              const watchStatus = await queryOne<{ play_count: number; last_played_at: Date }>(
                `SELECT play_count, last_played_at FROM watch_history 
                 WHERE user_id = $1 AND movie_id = $2`,
                [user.id, movie.id]
              )

              return {
                type: 'movie',
                apertureId: movie.id,
                embyId: movie.provider_item_id,
                title: movie.title,
                year: movie.year,
                tagline: movie.tagline,
                overview: movie.overview,
                genres: movie.genres,
                director: movie.director,
                cast: movie.cast?.slice(0, 10), // Top 10 cast
                runtime: movie.runtime ? `${runtimeHours}h ${runtimeMins}m` : null,
                communityRating: movie.community_rating,
                criticRating: movie.critic_rating,
                contentRating: movie.content_rating,
                releaseDate: movie.release_date,
                posterUrl: movie.poster_url,
                playLink,
                mediaServerType: mediaServer?.type || null,
                userRating: userRating?.rating || null,
                isWatched: !!watchStatus,
                playCount: watchStatus?.play_count || 0,
                lastWatched: watchStatus?.last_played_at || null,
              }
            }

            // Try to find as series
            const series = await queryOne<{
              id: string
              title: string
              year: number | null
              end_year: number | null
              genres: string[]
              overview: string | null
              community_rating: number | null
              poster_url: string | null
              provider_item_id: string | null
              network: string | null
              status: string | null
              content_rating: string | null
              critic_rating: number | null
            }>(
              `SELECT id, title, year, end_year, genres, overview, community_rating, poster_url,
                      provider_item_id, network, status, content_rating, critic_rating
               FROM series 
               WHERE title ILIKE $1 
               LIMIT 1`,
              [`%${title}%`]
            )

            if (series) {
              const playLink = buildPlayLink(mediaServer, series.provider_item_id, 'series')

              // Get season/episode counts
              const counts = await queryOne<{ season_count: string; episode_count: string }>(
                `SELECT COUNT(DISTINCT sea.id) as season_count, COUNT(e.id) as episode_count
                 FROM seasons sea
                 LEFT JOIN episodes e ON e.season_id = sea.id
                 WHERE sea.series_id = $1`,
                [series.id]
              )

              // Get user's rating if any
              const userRating = await queryOne<{ rating: number }>(
                `SELECT rating FROM user_ratings WHERE user_id = $1 AND series_id = $2`,
                [user.id, series.id]
              )

              // Check how many episodes watched
              const watchStatus = await queryOne<{ episodes_watched: string }>(
                `SELECT COUNT(DISTINCT wh.episode_id) as episodes_watched
                 FROM watch_history wh
                 JOIN episodes e ON e.id = wh.episode_id
                 JOIN seasons sea ON sea.id = e.season_id
                 WHERE wh.user_id = $1 AND sea.series_id = $2`,
                [user.id, series.id]
              )

              const yearDisplay = series.end_year
                ? `${series.year} – ${series.end_year}`
                : series.year
                  ? `${series.year} – Present`
                  : null

              return {
                type: 'series',
                apertureId: series.id,
                embyId: series.provider_item_id,
                title: series.title,
                yearRange: yearDisplay,
                startYear: series.year,
                endYear: series.end_year,
                overview: series.overview,
                genres: series.genres,
                network: series.network,
                status: series.status,
                seasonCount: parseInt(counts?.season_count || '0'),
                episodeCount: parseInt(counts?.episode_count || '0'),
                communityRating: series.community_rating,
                criticRating: series.critic_rating,
                contentRating: series.content_rating,
                posterUrl: series.poster_url,
                playLink,
                mediaServerType: mediaServer?.type || null,
                userRating: userRating?.rating || null,
                episodesWatched: parseInt(watchStatus?.episodes_watched || '0'),
              }
            }

            return {
              error: `"${title}" not found in your library. Try searching with searchContent tool to see available titles.`,
            }
          },
        }),

        // ============================================
        // SEARCH PEOPLE - Actors, Directors, etc.
        // ============================================
        searchPeople: tool({
          description:
            'Search for actors, directors, or other people in your library. Returns their filmography with images. Use for "movies with Tom Hanks", "Christopher Nolan films", "who directed X".',
          parameters: z.object({
            name: z.string().describe('Name of the person to search for'),
            role: z
              .enum(['actor', 'director', 'writer', 'any'])
              .optional()
              .default('any')
              .describe('Filter by role'),
            limit: z.number().optional().default(10).describe('Max results'),
          }),
          execute: async ({ name, role = 'any', limit = 10 }) => {
            const results: {
              actors?: Array<{
                name: string
                thumb: string | null
                movies: Array<{ title: string; year: number | null; role: string | null }>
                series: Array<{ title: string; year: number | null; role: string | null }>
              }>
              directors?: Array<{
                name: string
                movies: Array<{ title: string; year: number | null }>
                series: Array<{ title: string; year: number | null }>
              }>
              writers?: Array<{
                name: string
                movies: Array<{ title: string; year: number | null }>
                series: Array<{ title: string; year: number | null }>
              }>
            } = {}

            // Search actors
            if (role === 'actor' || role === 'any') {
              const actorMovies = await query<{
                actor_name: string
                actor_thumb: string | null
                actor_role: string | null
                title: string
                year: number | null
              }>(
                `SELECT 
                   actor->>'name' as actor_name,
                   actor->>'thumb' as actor_thumb,
                   actor->>'role' as actor_role,
                   m.title,
                   m.year
                 FROM movies m,
                 LATERAL jsonb_array_elements(m.actors) as actor
                 WHERE actor->>'name' ILIKE $1
                 ORDER BY m.year DESC NULLS LAST
                 LIMIT $2`,
                [`%${name}%`, limit * 5]
              )

              const actorSeries = await query<{
                actor_name: string
                actor_thumb: string | null
                actor_role: string | null
                title: string
                year: number | null
              }>(
                `SELECT 
                   actor->>'name' as actor_name,
                   actor->>'thumb' as actor_thumb,
                   actor->>'role' as actor_role,
                   s.title,
                   s.year
                 FROM series s,
                 LATERAL jsonb_array_elements(s.actors) as actor
                 WHERE actor->>'name' ILIKE $1
                 ORDER BY s.year DESC NULLS LAST
                 LIMIT $2`,
                [`%${name}%`, limit * 5]
              )

              // Group by actor name
              const actorMap = new Map<
                string,
                {
                  name: string
                  thumb: string | null
                  movies: Array<{ title: string; year: number | null; role: string | null }>
                  series: Array<{ title: string; year: number | null; role: string | null }>
                }
              >()

              for (const row of actorMovies.rows) {
                const existing = actorMap.get(row.actor_name) || {
                  name: row.actor_name,
                  thumb: row.actor_thumb,
                  movies: [],
                  series: [],
                }
                existing.movies.push({
                  title: row.title,
                  year: row.year,
                  role: row.actor_role,
                })
                actorMap.set(row.actor_name, existing)
              }

              for (const row of actorSeries.rows) {
                const existing = actorMap.get(row.actor_name) || {
                  name: row.actor_name,
                  thumb: row.actor_thumb,
                  movies: [],
                  series: [],
                }
                existing.series.push({
                  title: row.title,
                  year: row.year,
                  role: row.actor_role,
                })
                actorMap.set(row.actor_name, existing)
              }

              results.actors = Array.from(actorMap.values()).slice(0, limit)
            }

            // Search directors
            if (role === 'director' || role === 'any') {
              const directorMovies = await query<{ director: string; title: string; year: number | null }>(
                `SELECT unnest(directors) as director, title, year
                 FROM movies
                 WHERE EXISTS (SELECT 1 FROM unnest(directors) d WHERE d ILIKE $1)
                 ORDER BY year DESC NULLS LAST
                 LIMIT $2`,
                [`%${name}%`, limit * 5]
              )

              const directorSeries = await query<{ director: string; title: string; year: number | null }>(
                `SELECT unnest(directors) as director, title, year
                 FROM series
                 WHERE EXISTS (SELECT 1 FROM unnest(directors) d WHERE d ILIKE $1)
                 ORDER BY year DESC NULLS LAST
                 LIMIT $2`,
                [`%${name}%`, limit * 5]
              )

              const directorMap = new Map<
                string,
                {
                  name: string
                  movies: Array<{ title: string; year: number | null }>
                  series: Array<{ title: string; year: number | null }>
                }
              >()

              for (const row of directorMovies.rows) {
                if (row.director.toLowerCase().includes(name.toLowerCase())) {
                  const existing = directorMap.get(row.director) || {
                    name: row.director,
                    movies: [],
                    series: [],
                  }
                  existing.movies.push({ title: row.title, year: row.year })
                  directorMap.set(row.director, existing)
                }
              }

              for (const row of directorSeries.rows) {
                if (row.director.toLowerCase().includes(name.toLowerCase())) {
                  const existing = directorMap.get(row.director) || {
                    name: row.director,
                    movies: [],
                    series: [],
                  }
                  existing.series.push({ title: row.title, year: row.year })
                  directorMap.set(row.director, existing)
                }
              }

              results.directors = Array.from(directorMap.values()).slice(0, limit)
            }

            // Search writers
            if (role === 'writer' || role === 'any') {
              const writerMovies = await query<{ writer: string; title: string; year: number | null }>(
                `SELECT unnest(writers) as writer, title, year
                 FROM movies
                 WHERE EXISTS (SELECT 1 FROM unnest(writers) w WHERE w ILIKE $1)
                 ORDER BY year DESC NULLS LAST
                 LIMIT $2`,
                [`%${name}%`, limit * 5]
              )

              const writerMap = new Map<
                string,
                { name: string; movies: Array<{ title: string; year: number | null }>; series: never[] }
              >()

              for (const row of writerMovies.rows) {
                if (row.writer.toLowerCase().includes(name.toLowerCase())) {
                  const existing = writerMap.get(row.writer) || {
                    name: row.writer,
                    movies: [],
                    series: [],
                  }
                  existing.movies.push({ title: row.title, year: row.year })
                  writerMap.set(row.writer, existing)
                }
              }

              results.writers = Array.from(writerMap.values()).slice(0, limit)
            }

            const totalFound =
              (results.actors?.length || 0) +
              (results.directors?.length || 0) +
              (results.writers?.length || 0)

            if (totalFound === 0) {
              return { error: `No one named "${name}" found in your library.` }
            }

            return results
          },
        }),

        // ============================================
        // GET TOP STUDIOS - Most watched studios
        // ============================================
        getTopStudios: tool({
          description:
            'Get the user\'s most watched studios and networks. Use for "what studios do I watch", "favorite studios", "top networks".',
          parameters: z.object({
            type: z.enum(['movies', 'series', 'both']).optional().default('both'),
            limit: z.number().optional().default(10),
          }),
          execute: async ({ type = 'both', limit = 10 }) => {
            const results: {
              studios?: Array<{ name: string; movieCount: number; topMovies: string[] }>
              networks?: Array<{ name: string; seriesCount: number; topSeries: string[] }>
            } = {}

            if (type === 'movies' || type === 'both') {
              // Get studios from watched movies
              const studioData = await query<{ studio: string; count: string }>(
                `SELECT unnest(m.studios) as studio, COUNT(DISTINCT m.id) as count
                 FROM movies m
                 JOIN watch_history wh ON wh.movie_id = m.id
                 WHERE wh.user_id = $1
                 GROUP BY studio
                 ORDER BY count DESC
                 LIMIT $2`,
                [user.id, limit]
              )

              const studios: Array<{ name: string; movieCount: number; topMovies: string[] }> = []
              for (const row of studioData.rows) {
                // Get top movies for this studio
                const topMovies = await query<{ title: string }>(
                  `SELECT m.title
                   FROM movies m
                   JOIN watch_history wh ON wh.movie_id = m.id
                   WHERE wh.user_id = $1 AND $2 = ANY(m.studios)
                   ORDER BY m.community_rating DESC NULLS LAST
                   LIMIT 3`,
                  [user.id, row.studio]
                )
                studios.push({
                  name: row.studio,
                  movieCount: parseInt(row.count),
                  topMovies: topMovies.rows.map((m) => m.title),
                })
              }
              results.studios = studios
            }

            if (type === 'series' || type === 'both') {
              // Get networks from watched series
              const networkData = await query<{ network: string; count: string }>(
                `SELECT s.network, COUNT(DISTINCT s.id) as count
                 FROM series s
                 JOIN seasons sea ON sea.series_id = s.id
                 JOIN episodes e ON e.season_id = sea.id
                 JOIN watch_history wh ON wh.episode_id = e.id
                 WHERE wh.user_id = $1 AND s.network IS NOT NULL
                 GROUP BY s.network
                 ORDER BY count DESC
                 LIMIT $2`,
                [user.id, limit]
              )

              const networks: Array<{ name: string; seriesCount: number; topSeries: string[] }> = []
              for (const row of networkData.rows) {
                // Get top series for this network
                const topSeries = await query<{ title: string }>(
                  `SELECT DISTINCT s.title
                   FROM series s
                   JOIN seasons sea ON sea.series_id = s.id
                   JOIN episodes e ON e.season_id = sea.id
                   JOIN watch_history wh ON wh.episode_id = e.id
                   WHERE wh.user_id = $1 AND s.network = $2
                   ORDER BY s.community_rating DESC NULLS LAST
                   LIMIT 3`,
                  [user.id, row.network]
                )
                networks.push({
                  name: row.network,
                  seriesCount: parseInt(row.count),
                  topSeries: topSeries.rows.map((s) => s.title),
                })
              }
              results.networks = networks
            }

            return results
          },
        }),

        // ============================================
        // GET SYSTEM HELP - Documentation & How-to
        // ============================================
        getSystemHelp: tool({
          description:
            'Get help on how to use Aperture. Use for "how do I", "help", "what can I do", "how does X work". Returns relevant documentation.',
          parameters: z.object({
            topic: z
              .string()
              .optional()
              .describe('Specific topic to get help on (e.g., "ratings", "recommendations", "jobs")'),
          }),
          execute: async ({ topic }) => {
            // Return comprehensive help based on topic
            const generalHelp = {
              overview: `Aperture is an AI-powered recommendation system for your media server (Emby/Jellyfin).`,
              capabilities: [
                'AI-generated personalized movie and TV series recommendations',
                '10-heart rating system (syncs with Trakt.tv)',
                'Watch history tracking and analytics',
                'Virtual "AI Picks" libraries in your media server',
                'Top Picks showing globally popular content',
                'Custom channels/playlists with AI generation',
                'Detailed watch stats with genre/actor/director breakdowns',
              ],
              navigation: {
                Dashboard: 'Your personalized home with recommendations, trending, and activity',
                Movies: 'Browse your movie library with search and genre filters',
                Series: 'Browse TV series with network filters',
                'Top Movies/Series': 'See what\'s popular across all users',
                History: 'Your complete watch history',
                'Watch Stats': 'Analytics about your viewing habits',
                Settings: 'Customize library names, rating behavior, taste profiles',
              },
            }

            const topicHelp: Record<string, unknown> = {
              ratings: {
                title: 'Rating System',
                description:
                  'Aperture uses a 10-heart system compatible with Trakt.tv. Click the heart on any poster to rate.',
                howTo: [
                  'Click the heart icon in the bottom-right of any poster',
                  'Select your rating (1-10 hearts) in the popup',
                  'The heart fills proportionally to show your rating',
                  'Ratings sync to Trakt.tv if connected',
                ],
                effects: {
                  'High ratings (7-10)': 'Boost similar content in recommendations',
                  'Low ratings (1-3)': 'Exclude or penalize similar content (configurable)',
                },
              },
              recommendations: {
                title: 'AI Recommendations',
                description:
                  'Aperture analyzes your watch history to generate personalized picks.',
                factors: [
                  'Content similarity via AI embeddings',
                  'Genre preferences from your history',
                  'Your ratings (likes boost, dislikes reduce)',
                  'Balance of familiarity vs discovery',
                ],
                whereToFind: [
                  'Dashboard: "Your Movie Picks" and "Your Series Picks" carousels',
                  'My Recommendations page: Full list with match explanations',
                  'Media Server: Look for your "AI Picks" library',
                ],
              },
              trakt: {
                title: 'Trakt Integration',
                description: 'Connect Trakt.tv to sync ratings bidirectionally.',
                howToConnect: [
                  'Go to Settings',
                  'Click "Connect Trakt Account"',
                  'Authorize in the Trakt popup',
                  'Ratings sync automatically',
                ],
              },
              watchHistory: {
                title: 'Watch History',
                description:
                  'Aperture tracks what you watch from your media server automatically.',
                features: [
                  'View all watched movies and episodes',
                  'See play counts and last watched dates',
                  'Mark items as unwatched (if enabled by admin)',
                  'Filter by date range or type',
                ],
              },
            }

            if (topic) {
              const normalizedTopic = topic.toLowerCase()
              for (const [key, value] of Object.entries(topicHelp)) {
                if (normalizedTopic.includes(key)) {
                  return { topic: key, help: value, isAdmin: user.isAdmin }
                }
              }
            }

            // If admin, add admin help
            const adminHelp = user.isAdmin
              ? {
                  adminCapabilities: [
                    'Run sync jobs to import movies/series from media server',
                    'Generate embeddings for AI similarity matching',
                    'Configure recommendation algorithm weights',
                    'Enable/disable users for recommendations',
                    'Set up Top Picks with popularity thresholds',
                    'Configure STRM vs Symlinks output format',
                    'Manage library images for AI Picks libraries',
                    'Schedule automated jobs (sync, recommendations, etc.)',
                  ],
                  jobs: {
                    'sync-movies': 'Import movies from media server',
                    'sync-series': 'Import TV series and episodes',
                    'generate-movie-embeddings': 'Create AI embeddings for movies',
                    'generate-series-embeddings': 'Create AI embeddings for series',
                    'sync-movie-watch-history': 'Import user watch history for movies',
                    'sync-series-watch-history': 'Import user watch history for series',
                    'generate-movie-recommendations': 'Create personalized movie picks',
                    'generate-series-recommendations': 'Create personalized series picks',
                    'sync-movie-libraries': 'Create virtual movie library in media server',
                    'sync-series-libraries': 'Create virtual series library in media server',
                  },
                }
              : null

            return {
              generalHelp,
              topicHelp: topic ? null : topicHelp,
              adminHelp,
              isAdmin: user.isAdmin,
            }
          },
        }),
      }

      // Create the streaming response
      const result = streamText({
        model: openai(model),
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools,
        maxSteps: 10, // Allow complex multi-tool queries
        toolChoice: 'auto', // Let the model decide when to use tools
      })

      // Get the data stream response - this is compatible with the AI SDK's useChat
      const response = result.toDataStreamResponse()

      // Set headers from the response
      reply.raw.writeHead(200, {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      // Stream the response body
      if (response.body) {
        const reader = response.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            reply.raw.write(value)
          }
        } finally {
          reader.releaseLock()
        }
      }

      reply.raw.end()
      return reply
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const errorStack = err instanceof Error ? err.stack : undefined
      fastify.log.error({ err, errorMessage, errorStack }, 'Assistant chat error')

      // If headers already sent, we can't send a proper error response
      if (reply.raw.headersSent) {
        reply.raw.end()
        return
      }

      return reply.status(500).send({
        error: 'Failed to process chat request',
        message: errorMessage,
      })
    }
  })

  // ============================================
  // Conversation Management Endpoints
  // ============================================

  interface ConversationRow {
    id: string
    title: string
    created_at: Date
    updated_at: Date
  }

  interface MessageRow {
    id: string
    role: string
    content: string
    created_at: Date
  }

  /**
   * GET /api/assistant/conversations
   * List user's conversations
   */
  fastify.get(
    '/api/assistant/conversations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user as SessionUser

      const conversations = await query<ConversationRow>(
        `SELECT id, title, created_at, updated_at
         FROM assistant_conversations
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [user.id]
      )

      return reply.send({ conversations: conversations.rows })
    }
  )

  /**
   * POST /api/assistant/conversations
   * Create a new conversation
   */
  fastify.post<{
    Body: { title?: string }
  }>('/api/assistant/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user as SessionUser
    const { title = 'New Chat' } = request.body || {}

    const conversation = await queryOne<ConversationRow>(
      `INSERT INTO assistant_conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id, title, created_at, updated_at`,
      [user.id, title]
    )

    return reply.status(201).send({ conversation })
  })

  /**
   * GET /api/assistant/conversations/:id
   * Get a conversation with its messages
   */
  fastify.get<{
    Params: { id: string }
  }>('/api/assistant/conversations/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user as SessionUser
    const { id } = request.params

    // Verify ownership
    const conversation = await queryOne<ConversationRow>(
      `SELECT id, title, created_at, updated_at
         FROM assistant_conversations
         WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    // Get messages
    const messages = await query<MessageRow>(
      `SELECT id, role, content, created_at
         FROM assistant_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
      [id]
    )

    return reply.send({
      conversation,
      messages: messages.rows,
    })
  })

  /**
   * PATCH /api/assistant/conversations/:id
   * Update conversation (title)
   */
  fastify.patch<{
    Params: { id: string }
    Body: { title: string }
  }>('/api/assistant/conversations/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user as SessionUser
    const { id } = request.params
    const { title } = request.body

    const conversation = await queryOne<ConversationRow>(
      `UPDATE assistant_conversations
         SET title = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, title, created_at, updated_at`,
      [title, id, user.id]
    )

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    return reply.send({ conversation })
  })

  /**
   * DELETE /api/assistant/conversations/:id
   * Delete a conversation
   */
  fastify.delete<{
    Params: { id: string }
  }>('/api/assistant/conversations/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user as SessionUser
    const { id } = request.params

    const result = await query(
      `DELETE FROM assistant_conversations
         WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }

    return reply.status(204).send()
  })

  /**
   * POST /api/assistant/conversations/:id/messages
   * Add messages to a conversation (for saving chat history)
   */
  fastify.post<{
    Params: { id: string }
    Body: { messages: Array<{ role: string; content: string }> }
  }>(
    '/api/assistant/conversations/:id/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params
      const { messages } = request.body

      // Verify ownership
      const conversation = await queryOne<{ id: string }>(
        `SELECT id FROM assistant_conversations WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      )

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      // Insert messages
      for (const msg of messages) {
        await query(
          `INSERT INTO assistant_messages (conversation_id, role, content)
           VALUES ($1, $2, $3)`,
          [id, msg.role, msg.content]
        )
      }

      // Update conversation title from first user message if still "New Chat"
      const existingConvo = await queryOne<{ title: string }>(
        `SELECT title FROM assistant_conversations WHERE id = $1`,
        [id]
      )

      if (existingConvo?.title === 'New Chat') {
        const firstUserMsg = messages.find((m) => m.role === 'user')
        if (firstUserMsg) {
          const newTitle =
            firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
          await query(
            `UPDATE assistant_conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
            [newTitle, id]
          )
        }
      } else {
        // Just update the timestamp
        await query(`UPDATE assistant_conversations SET updated_at = NOW() WHERE id = $1`, [id])
      }

      return reply.status(201).send({ success: true })
    }
  )
}

export default assistantRoutes
