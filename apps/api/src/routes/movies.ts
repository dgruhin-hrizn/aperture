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
      showAll?: string
    }
    Reply: MoviesListResponse
  }>('/api/movies', { preHandler: requireAuth }, async (request, reply) => {
    const page = parseInt(request.query.page || '1', 10)
    const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
    const offset = (page - 1) * pageSize
    const { search, genre, showAll } = request.query

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
              community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at
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
   * Get movie by ID
   */
  fastify.get<{ Params: { id: string }; Reply: MovieRow }>(
    '/api/movies/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      const movie = await queryOne<MovieRow>(
        `SELECT id, provider_item_id, title, original_title, year, genres, overview,
                community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at
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
                1 - (e.embedding <=> $1::vector) as similarity
         FROM embeddings e
         JOIN movies m ON m.id = e.movie_id
         WHERE e.movie_id != $2
         ORDER BY e.embedding <=> $1::vector
         LIMIT $3`,
        [embedding.embedding, id, limit]
      )

      return reply.send({ similar: result.rows })
    }
  )
}

export default moviesRoutes

