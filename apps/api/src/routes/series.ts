import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'

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
    }
    Reply: SeriesListResponse
  }>('/api/series', { preHandler: requireAuth }, async (request, reply) => {
    const page = parseInt(request.query.page || '1', 10)
    const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
    const offset = (page - 1) * pageSize
    const { search, genre, network, status, minRtScore, showAll } = request.query

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
              poster_url, backdrop_url, created_at, updated_at
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
                keywords, rt_critic_score, rt_audience_score, rt_consensus, metacritic_score, awards_summary
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

      // Get the series' embedding
      const embedding = await queryOne<{ embedding: string }>(
        `SELECT embedding FROM series_embeddings WHERE series_id = $1`,
        [id]
      )

      if (!embedding) {
        return reply.send({ similar: [], message: 'No embedding found for this series' })
      }

      // Find similar series using cosine similarity
      const result = await query(
        `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.network,
                1 - (se.embedding <=> $1::halfvec) as similarity
         FROM series_embeddings se
         JOIN series s ON s.id = se.series_id
         WHERE se.series_id != $2
         ORDER BY se.embedding <=> $1::halfvec
         LIMIT $3`,
        [embedding.embedding, id, limit]
      )

      return reply.send({ similar: result.rows })
    }
  )
}

export default seriesRoutes

