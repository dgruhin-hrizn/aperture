import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'

interface MovieRow {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  runtime_minutes: number | null
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

interface Actor {
  name: string
  role?: string
  thumb?: string
}

interface Studio {
  id?: string
  name: string
}

interface MovieDetailRow extends MovieRow {
  // Cast & Crew
  actors: Actor[] | null
  directors: string[] | null
  writers: string[] | null
  cinematographers: string[] | null
  composers: string[] | null
  editors: string[] | null
  studios: Studio[] | null
  // External IDs
  imdb_id: string | null
  tmdb_id: string | null
  // TMDb enrichment
  keywords: string[] | null
  collection_id: string | null
  collection_name: string | null
  // OMDb enrichment
  rt_critic_score: number | null
  rt_audience_score: number | null
  rt_consensus: string | null
  metacritic_score: number | null
  awards_summary: string | null
  languages: string[] | null
  production_countries: string[] | null
  // MDBList enrichment
  letterboxd_score: number | null
  mdblist_score: number | null
  streaming_providers: StreamingProvider[] | null
}

interface MoviesListResponse {
  movies: MovieRow[]
  total: number
  page: number
  pageSize: number
}

const moviesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/movies
   * List all movies with pagination
   */
  fastify.get<{
    Querystring: {
      page?: string
      pageSize?: string
      search?: string
      genre?: string
      collection?: string
      minRtScore?: string
      showAll?: string
      hasAwards?: string
    }
    Reply: MoviesListResponse
  }>('/api/movies', { preHandler: requireAuth }, async (request, reply) => {
    const page = parseInt(request.query.page || '1', 10)
    const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
    const offset = (page - 1) * pageSize
    const { search, genre, collection, minRtScore, showAll, hasAwards } = request.query

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
        WHERE lc.provider_library_id = movies.provider_library_id 
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

    if (collection) {
      whereClause += whereClause ? ' AND ' : ' WHERE '
      whereClause += `collection_name = $${paramIndex++}`
      params.push(collection)
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
      `SELECT COUNT(*) as count FROM movies${whereClause}`,
      params
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get movies
    params.push(pageSize, offset)
    const result = await query<MovieRow>(
      `SELECT id, provider_item_id, title, original_title, year, genres, overview,
              community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at,
              rt_critic_score, awards_summary
       FROM movies${whereClause}
       ORDER BY title ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    )

    return reply.send({
      movies: result.rows,
      total,
      page,
      pageSize,
    })
  })

  /**
   * GET /api/movies/:id
   * Get movie by ID with full metadata including enrichment data
   */
  fastify.get<{ Params: { id: string }; Reply: MovieDetailRow }>(
    '/api/movies/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      const movie = await queryOne<MovieDetailRow>(
        `SELECT id, provider_item_id, title, original_title, year, genres, overview,
                community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at,
                actors, directors, writers, cinematographers, composers, editors, studios,
                imdb_id, tmdb_id, keywords, collection_id, collection_name,
                rt_critic_score, rt_audience_score, rt_consensus, metacritic_score, awards_summary,
                languages, production_countries, letterboxd_score, mdblist_score, streaming_providers
         FROM movies WHERE id = $1`,
        [id]
      )

      if (!movie) {
        return reply.status(404).send({ error: 'Movie not found' } as never)
      }

      return reply.send(movie)
    }
  )

  /**
   * GET /api/movies/:id/watch-stats
   * Get comprehensive watch statistics for a movie
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/movies/:id/watch-stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      // Get watch history stats
      const watchStats = await queryOne<{
        total_watchers: string
        total_plays: string
        favorites_count: string
        first_watched: Date | null
        last_watched: Date | null
      }>(
        `SELECT 
          COUNT(DISTINCT user_id) as total_watchers,
          COALESCE(SUM(play_count), 0) as total_plays,
          COUNT(DISTINCT CASE WHEN is_favorite THEN user_id END) as favorites_count,
          MIN(last_played_at) as first_watched,
          MAX(last_played_at) as last_watched
         FROM watch_history 
         WHERE movie_id = $1`,
        [id]
      )

      // Get user ratings stats
      const ratingStats = await queryOne<{
        avg_rating: string | null
        rating_count: string
        rating_distribution: string
      }>(
        `SELECT 
          AVG(rating)::numeric(3,1) as avg_rating,
          COUNT(*) as rating_count,
          json_object_agg(rating, count) as rating_distribution
         FROM (
           SELECT rating, COUNT(*) as count 
           FROM user_ratings 
           WHERE movie_id = $1 
           GROUP BY rating
         ) r`,
        [id]
      )

      // Get total user count for percentage calculation
      const userCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      const totalUsers = parseInt(userCount?.count || '1', 10)
      const watchers = parseInt(watchStats?.total_watchers || '0', 10)

      return reply.send({
        totalWatchers: watchers,
        totalPlays: parseInt(watchStats?.total_plays || '0', 10),
        favoritesCount: parseInt(watchStats?.favorites_count || '0', 10),
        firstWatched: watchStats?.first_watched || null,
        lastWatched: watchStats?.last_watched || null,
        // User ratings
        averageUserRating: ratingStats?.avg_rating ? parseFloat(ratingStats.avg_rating) : null,
        totalRatings: parseInt(ratingStats?.rating_count || '0', 10),
        // Percentage of users who watched
        watchPercentage: totalUsers > 0 ? Math.round((watchers / totalUsers) * 100) : 0,
        totalUsers,
      })
    }
  )

  /**
   * GET /api/movies/genres
   * Get all unique genres
   */
  fastify.get('/api/movies/genres', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ genre: string }>(
      `SELECT DISTINCT unnest(genres) as genre FROM movies ORDER BY genre`
    )

    return reply.send({ genres: result.rows.map((r) => r.genre) })
  })

  /**
   * GET /api/movies/keywords
   * Get all unique keywords (from TMDb enrichment)
   */
  fastify.get('/api/movies/keywords', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ keyword: string; count: string }>(
      `SELECT unnest(keywords) as keyword, COUNT(*) as count
       FROM movies WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0
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
   * GET /api/movies/collections
   * Get all collections/franchises
   */
  fastify.get('/api/movies/collections', { preHandler: requireAuth }, async (_request, reply) => {
    const result = await query<{ collection_name: string; count: string }>(
      `SELECT collection_name, COUNT(*) as count
       FROM movies 
       WHERE collection_name IS NOT NULL
       GROUP BY collection_name
       ORDER BY COUNT(*) DESC`
    )

    return reply.send({ 
      collections: result.rows.map((r) => ({ name: r.collection_name, count: parseInt(r.count, 10) })) 
    })
  })

  /**
   * GET /api/movies/franchises
   * Get franchises with their movies and watch progress (paginated)
   */
  fastify.get<{
    Querystring: {
      page?: string
      pageSize?: string
      search?: string
      sortBy?: 'name' | 'total' | 'progress' | 'unwatched'
      showCompleted?: string
    }
  }>('/api/movies/franchises', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user?.id
    const page = Math.max(1, parseInt(request.query.page || '1', 10))
    const pageSize = Math.min(Math.max(1, parseInt(request.query.pageSize || '20', 10)), 50)
    const search = request.query.search?.trim().toLowerCase()
    const sortBy = request.query.sortBy || 'total'
    const showCompleted = request.query.showCompleted !== 'false'

    // Get aggregated franchise stats with a single query
    const franchiseStatsQuery = `
      WITH franchise_stats AS (
        SELECT 
          m.collection_name,
          COUNT(DISTINCT m.id) as total_movies,
          COUNT(DISTINCT wh.movie_id) as watched_movies
        FROM movies m
        LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = $1
        WHERE m.collection_name IS NOT NULL
        GROUP BY m.collection_name
      )
      SELECT 
        collection_name,
        total_movies::int,
        watched_movies::int,
        CASE 
          WHEN total_movies > 0 
          THEN ROUND((watched_movies::numeric / total_movies::numeric) * 100)::int 
          ELSE 0 
        END as progress
      FROM franchise_stats
      WHERE 1=1
        ${search ? `AND LOWER(collection_name) LIKE $2` : ''}
        ${!showCompleted ? `AND watched_movies < total_movies` : ''}
      ORDER BY ${
        sortBy === 'name' ? 'collection_name ASC' :
        sortBy === 'progress' ? 'progress DESC, total_movies DESC' :
        sortBy === 'unwatched' ? '(total_movies - watched_movies) DESC' :
        'total_movies DESC'
      }
    `

    const statsParams: unknown[] = [userId]
    if (search) {
      statsParams.push(`%${search}%`)
    }

    const allFranchiseStats = await query<{
      collection_name: string
      total_movies: number
      watched_movies: number
      progress: number
    }>(franchiseStatsQuery, statsParams)

    // Calculate global stats (before pagination)
    const totalFranchises = allFranchiseStats.rows.length
    const completedFranchises = allFranchiseStats.rows.filter(f => f.progress === 100).length
    const totalMovies = allFranchiseStats.rows.reduce((sum, f) => sum + f.total_movies, 0)
    const watchedMovies = allFranchiseStats.rows.reduce((sum, f) => sum + f.watched_movies, 0)

    // Paginate the results
    const offset = (page - 1) * pageSize
    const paginatedStats = allFranchiseStats.rows.slice(offset, offset + pageSize)

    if (paginatedStats.length === 0) {
      return reply.send({
        franchises: [],
        total: totalFranchises,
        page,
        pageSize,
        stats: {
          totalFranchises,
          completedFranchises,
          totalMovies,
          watchedMovies,
        }
      })
    }

    // Get movies only for the paginated franchises
    const franchiseNames = paginatedStats.map(f => f.collection_name)
    const moviesResult = await query<{
      collection_name: string
      movie_id: string
      movie_title: string
      year: number | null
      poster_url: string | null
      community_rating: number | null
      rt_critic_score: number | null
      watched: boolean
    }>(
      `SELECT 
         m.collection_name,
         m.id as movie_id,
         m.title as movie_title,
         m.year,
         m.poster_url,
         m.community_rating,
         m.rt_critic_score,
         CASE WHEN wh.id IS NOT NULL THEN true ELSE false END as watched
       FROM movies m
       LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = $1
       WHERE m.collection_name = ANY($2)
       ORDER BY m.year NULLS LAST`,
      [userId, franchiseNames]
    )

    // Group movies by collection
    const moviesByCollection = new Map<string, Array<{
      id: string
      title: string
      year: number | null
      posterUrl: string | null
      rating: number | null
      rtScore: number | null
      watched: boolean
    }>>()

    for (const row of moviesResult.rows) {
      if (!moviesByCollection.has(row.collection_name)) {
        moviesByCollection.set(row.collection_name, [])
      }
      moviesByCollection.get(row.collection_name)!.push({
        id: row.movie_id,
        title: row.movie_title,
        year: row.year,
        posterUrl: row.poster_url,
        rating: row.community_rating,
        rtScore: row.rt_critic_score,
        watched: row.watched,
      })
    }

    // Build final franchise objects in the same order as paginatedStats
    const franchises = paginatedStats.map(stat => ({
      name: stat.collection_name,
      movies: moviesByCollection.get(stat.collection_name) || [],
      totalMovies: stat.total_movies,
      watchedMovies: stat.watched_movies,
      progress: stat.progress,
    }))

    return reply.send({
      franchises,
      total: totalFranchises,
      page,
      pageSize,
      stats: {
        totalFranchises,
        completedFranchises,
        totalMovies,
        watchedMovies,
      }
    })
  })

  /**
   * GET /api/movies/:id/similar
   * Get similar movies based on embedding similarity
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/movies/:id/similar',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50)

      // Get the movie's embedding
      const embedding = await queryOne<{ embedding: string }>(
        `SELECT embedding FROM embeddings WHERE movie_id = $1`,
        [id]
      )

      if (!embedding) {
        return reply.send({ similar: [], message: 'No embedding found for this movie' })
      }

      // Find similar movies using cosine similarity
      const result = await query(
        `SELECT m.id, m.title, m.year, m.poster_url, m.genres,
                1 - (e.embedding <=> $1::halfvec) as similarity
         FROM embeddings e
         JOIN movies m ON m.id = e.movie_id
         WHERE e.movie_id != $2
         ORDER BY e.embedding <=> $1::halfvec
         LIMIT $3`,
        [embedding.embedding, id, limit]
      )

      return reply.send({ similar: result.rows })
    }
  )
}

export default moviesRoutes

