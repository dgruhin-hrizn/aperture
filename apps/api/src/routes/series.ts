import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import { getSimilarSeries } from '@aperture/core'

interface SeriesRow {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  end_year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  status: string | null
  total_seasons: number | null
  total_episodes: number | null
  network: string | null
  poster_url: string | null
  backdrop_url: string | null
  created_at: Date
  updated_at: Date
  // Enrichment fields for discovery pages
  rt_critic_score: number | null
  awards_summary: string | null
}

interface StreamingProvider {
  id: number
  name: string
}

interface SeriesDetailRow extends SeriesRow {
  tagline: string | null
  content_rating: string | null
  critic_rating: number | null
  studios: string[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  imdb_id: string | null
  tmdb_id: string | null
  tvdb_id: string | null
  air_days: string[]
  production_countries: string[]
  awards: string | null
  // TMDb enrichment
  keywords: string[] | null
  // OMDb enrichment
  rt_critic_score: number | null
  rt_audience_score: number | null
  rt_consensus: string | null
  metacritic_score: number | null
  awards_summary: string | null
  languages: string[] | null
  // MDBList enrichment
  letterboxd_score: number | null
  mdblist_score: number | null
  streaming_providers: StreamingProvider[] | null
}

interface SeriesListResponse {
  series: SeriesRow[]
  total: number
  page: number
  pageSize: number
}

const seriesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/series
   * List all series with pagination
   */
  fastify.get<{
    Querystring: {
      page?: string
      pageSize?: string
      search?: string
      genre?: string
      network?: string
      status?: string
      minRtScore?: string
      showAll?: string
      hasAwards?: string
    }
    Reply: SeriesListResponse
  }>('/api/series', { preHandler: requireAuth }, async (request, reply) => {
    const page = parseInt(request.query.page || '1', 10)
    const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
    const offset = (page - 1) * pageSize
    const { search, genre, network, status, minRtScore, showAll, hasAwards } = request.query

    // Check if library configs exist
    const configCheck = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM library_config'
    )
    const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0
    const filterByLibrary = hasLibraryConfigs && showAll !== 'true'

    let whereClause = ''
    const params: unknown[] = []
    let paramIndex = 1

    // Filter by enabled libraries (unless showAll=true or no library configs exist)
    if (filterByLibrary) {
      whereClause = ` WHERE EXISTS (
        SELECT 1 FROM library_config lc 
        WHERE lc.provider_library_id = series.provider_library_id 
        AND lc.is_enabled = true
      )`
    }

    if (search) {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `title ILIKE $${paramIndex++}`
      params.push(`%${search}%`)
    }

    if (genre) {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `$${paramIndex++} = ANY(genres)`
      params.push(genre)
    }

    if (network) {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `network = $${paramIndex++}`
      params.push(network)
    }

    if (status) {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `status = $${paramIndex++}`
      params.push(status)
    }

    if (minRtScore) {
      const rtScore = parseInt(minRtScore, 10)
      if (rtScore > 0) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `rt_critic_score >= $${paramIndex++}`
        params.push(rtScore)
      }
    }

    if (hasAwards === 'true') {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `awards_summary IS NOT NULL`
    }

    // Get total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM series${whereClause}`,
      params
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get series
    params.push(pageSize, offset)
    const result = await query<SeriesRow>(
      `SELECT id, provider_item_id, title, original_title, year, end_year, genres, overview,
              community_rating, status, total_seasons, total_episodes, network,
              poster_url, backdrop_url, created_at, updated_at,
              rt_critic_score, awards_summary
       FROM series${whereClause}
       ORDER BY title ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    )

    return reply.send({
      series: result.rows,
      total,
      page,
      pageSize,
    })
  })

  /**
   * GET /api/series/:id
   * Get series by ID with full metadata
   */
  fastify.get<{ Params: { id: string }; Reply: SeriesDetailRow }>(
    '/api/series/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      const series = await queryOne<SeriesDetailRow>(
        `SELECT id, provider_item_id, title, original_title, year, end_year, genres, overview,
                community_rating, critic_rating, content_rating, status, total_seasons, total_episodes, 
                network, tagline, studios, directors, writers, actors,
                imdb_id, tmdb_id, tvdb_id, air_days, production_countries, awards,
                poster_url, backdrop_url, created_at, updated_at,
                keywords, rt_critic_score, rt_audience_score, rt_consensus, metacritic_score, awards_summary,
                languages, letterboxd_score, mdblist_score, streaming_providers
         FROM series WHERE id = $1`,
        [id]
      )

      if (!series) {
        return reply.status(404).send({ error: 'Series not found' } as never)
      }

      return reply.send(series)
    }
  )

  /**
   * GET /api/series/:id/watch-stats
   * Get comprehensive watch statistics for a series
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/series/:id/watch-stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      // Get total episodes for calculating completion percentage
      const seriesInfo = await queryOne<{ total_episodes: number }>(
        `SELECT total_episodes FROM series WHERE id = $1`,
        [id]
      )
      const totalEpisodes = seriesInfo?.total_episodes || 0

      // Users currently watching this series
      const watchingCount = await queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_watching_series WHERE series_id = $1`,
        [id]
      )

      // Users who have watched episodes and their completion status
      const watchStats = await query<{
        user_id: string
        episodes_watched: string
        total_plays: string
        favorites_count: string
        first_watched: Date | null
        last_watched: Date | null
      }>(
        `SELECT 
          wh.user_id,
          COUNT(DISTINCT wh.episode_id) as episodes_watched,
          SUM(wh.play_count) as total_plays,
          COUNT(DISTINCT CASE WHEN wh.is_favorite THEN wh.episode_id END) as favorites_count,
          MIN(wh.last_played_at) as first_watched,
          MAX(wh.last_played_at) as last_watched
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         WHERE e.series_id = $1 AND wh.episode_id IS NOT NULL
         GROUP BY wh.user_id`,
        [id]
      )

      // Calculate completed viewers (watched all episodes)
      const completedViewers = totalEpisodes > 0
        ? watchStats.rows.filter(s => parseInt(s.episodes_watched, 10) >= totalEpisodes).length
        : 0

      // Get user ratings for this series
      const ratingStats = await queryOne<{
        avg_rating: string | null
        rating_count: string
      }>(
        `SELECT 
          AVG(rating)::numeric(3,1) as avg_rating,
          COUNT(*) as rating_count
         FROM user_ratings 
         WHERE series_id = $1`,
        [id]
      )

      // Calculate average progress (what % of the show users have watched on average)
      const avgProgress = totalEpisodes > 0 && watchStats.rows.length > 0
        ? Math.round(
            watchStats.rows.reduce((sum, s) => sum + parseInt(s.episodes_watched, 10), 0) /
            watchStats.rows.length /
            totalEpisodes *
            100
          )
        : 0

      // Get total user count for percentage calculation  
      const userCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      const totalUsers = parseInt(userCount?.count || '1', 10)

      // Sum favorites across all users
      const totalFavorites = watchStats.rows.reduce(
        (sum, s) => sum + parseInt(s.favorites_count, 10), 0
      )

      return reply.send({
        currentlyWatching: parseInt(watchingCount?.count || '0', 10),
        totalViewers: watchStats.rows.length,
        completedViewers,
        totalEpisodes,
        totalEpisodePlays: watchStats.rows.reduce((sum, s) => sum + parseInt(s.total_plays, 10), 0),
        favoritedEpisodes: totalFavorites,
        firstWatched: watchStats.rows.length > 0 
          ? new Date(Math.min(...watchStats.rows.filter(s => s.first_watched).map(s => new Date(s.first_watched!).getTime())))
          : null,
        lastWatched: watchStats.rows.length > 0
          ? new Date(Math.max(...watchStats.rows.filter(s => s.last_watched).map(s => new Date(s.last_watched!).getTime())))
          : null,
        // User ratings
        averageUserRating: ratingStats?.avg_rating ? parseFloat(ratingStats.avg_rating) : null,
        totalRatings: parseInt(ratingStats?.rating_count || '0', 10),
        // Progress metrics
        averageProgress: avgProgress,
        watchPercentage: totalUsers > 0 ? Math.round((watchStats.rows.length / totalUsers) * 100) : 0,
        totalUsers,
      })
    }
  )

  /**
   * GET /api/series/genres
   * Get all unique genres
   */
  fastify.get('/api/series/genres', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ genre: string }>(
      `SELECT DISTINCT unnest(genres) as genre FROM series ORDER BY genre`
    )

    return reply.send({ genres: result.rows.map((r) => r.genre) })
  })

  /**
   * GET /api/series/networks
   * Get all unique networks
   */
  fastify.get('/api/series/networks', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ network: string }>(
      `SELECT DISTINCT network FROM series WHERE network IS NOT NULL ORDER BY network`
    )

    return reply.send({ networks: result.rows.map((r) => r.network) })
  })

  /**
   * GET /api/series/keywords
   * Get all unique keywords (from TMDb enrichment)
   */
  fastify.get('/api/series/keywords', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ keyword: string; count: string }>(
      `SELECT unnest(keywords) as keyword, COUNT(*) as count
       FROM series WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0
       GROUP BY unnest(keywords)
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 100`
    )

    return reply.send({ 
      keywords: result.rows.map((r) => ({ name: r.keyword, count: parseInt(r.count, 10) })) 
    })
  })

  /**
   * GET /api/series/:id/episodes
   * Get all episodes for a series, grouped by season
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/series/:id/episodes',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      const result = await query<{
        id: string
        season_number: number
        episode_number: number
        title: string
        overview: string | null
        premiere_date: string | null
        runtime_minutes: number | null
        community_rating: number | null
        poster_url: string | null
      }>(
        `SELECT id, season_number, episode_number, title, overview, 
                premiere_date, runtime_minutes, community_rating, poster_url
         FROM episodes
         WHERE series_id = $1
         ORDER BY season_number ASC, episode_number ASC`,
        [id]
      )

      // Group by season
      const seasons: Record<number, typeof result.rows> = {}
      for (const ep of result.rows) {
        if (!seasons[ep.season_number]) {
          seasons[ep.season_number] = []
        }
        seasons[ep.season_number].push(ep)
      }

      return reply.send({
        episodes: result.rows,
        seasons,
        totalEpisodes: result.rows.length,
        seasonCount: Object.keys(seasons).length,
      })
    }
  )

  /**
   * GET /api/series/:id/similar
   * Get similar series based on embedding similarity
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/series/:id/similar',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50)

      try {
        const result = await getSimilarSeries(id, { limit })
        
        // Transform to the expected response format
        const similar = result.connections.map((conn) => ({
          id: conn.item.id,
          title: conn.item.title,
          year: conn.item.year,
          poster_url: conn.item.poster_url,
          genres: conn.item.genres,
          network: conn.item.network,
          similarity: conn.similarity,
        }))

        return reply.send({ similar })
      } catch (error) {
        // Series not found or no embedding
        return reply.send({ similar: [], message: 'No embedding found for this series' })
      }
    }
  )
}

export default seriesRoutes

