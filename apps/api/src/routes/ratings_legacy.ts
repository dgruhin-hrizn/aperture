import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'
import { pushRatingToTrakt, removeRatingFromTrakt, getUserTraktStatus } from '@aperture/core'

interface UserRating {
  id: string
  movie_id: string | null
  series_id: string | null
  rating: number
  source: string
  created_at: Date
  updated_at: Date
  // Joined fields
  title?: string
  year?: number | null
  poster_url?: string | null
}

interface RatingsListResponse {
  ratings: UserRating[]
  movies: UserRating[]
  series: UserRating[]
}

const ratingsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/ratings
   * Get all ratings for the current user
   */
  fastify.get<{ Reply: RatingsListResponse }>(
    '/api/ratings',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser

      // Get movie ratings with movie info
      const movieRatings = await query<UserRating>(
        `SELECT ur.id, ur.movie_id, ur.series_id, ur.rating, ur.source, ur.created_at, ur.updated_at,
                m.title, m.year, m.poster_url
         FROM user_ratings ur
         JOIN movies m ON m.id = ur.movie_id
         WHERE ur.user_id = $1 AND ur.movie_id IS NOT NULL
         ORDER BY ur.updated_at DESC`,
        [user.id]
      )

      // Get series ratings with series info
      const seriesRatings = await query<UserRating>(
        `SELECT ur.id, ur.movie_id, ur.series_id, ur.rating, ur.source, ur.created_at, ur.updated_at,
                s.title, s.year, s.poster_url
         FROM user_ratings ur
         JOIN series s ON s.id = ur.series_id
         WHERE ur.user_id = $1 AND ur.series_id IS NOT NULL
         ORDER BY ur.updated_at DESC`,
        [user.id]
      )

      return reply.send({
        ratings: [...movieRatings.rows, ...seriesRatings.rows],
        movies: movieRatings.rows,
        series: seriesRatings.rows,
      })
    }
  )

  /**
   * GET /api/ratings/disliked
   * Get all disliked items (rating <= 3) for the current user
   * Used for displaying disliked content in the AI Algorithm settings
   */
  fastify.get<{
    Querystring: { type?: 'movie' | 'series' | 'all' }
    Reply: {
      movies: Array<{
        id: string
        title: string
        year: number | null
        posterUrl: string | null
        rating: number
      }>
      series: Array<{
        id: string
        title: string
        year: number | null
        posterUrl: string | null
        rating: number
      }>
      totalCount: number
    }
  }>(
    '/api/ratings/disliked',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const type = request.query.type || 'all'

      const movies: Array<{
        id: string
        title: string
        year: number | null
        posterUrl: string | null
        rating: number
      }> = []

      const series: Array<{
        id: string
        title: string
        year: number | null
        posterUrl: string | null
        rating: number
      }> = []

      if (type === 'all' || type === 'movie') {
        // Get disliked movies (rating 1-3)
        const movieResult = await query<{
          movie_id: string
          rating: number
          title: string
          year: number | null
          poster_url: string | null
        }>(
          `SELECT ur.movie_id, ur.rating, m.title, m.year, m.poster_url
           FROM user_ratings ur
           JOIN movies m ON m.id = ur.movie_id
           WHERE ur.user_id = $1 AND ur.movie_id IS NOT NULL AND ur.rating <= 3
           ORDER BY m.title ASC`,
          [user.id]
        )

        for (const row of movieResult.rows) {
          movies.push({
            id: row.movie_id,
            title: row.title,
            year: row.year,
            posterUrl: row.poster_url,
            rating: row.rating,
          })
        }
      }

      if (type === 'all' || type === 'series') {
        // Get disliked series (rating 1-3)
        const seriesResult = await query<{
          series_id: string
          rating: number
          title: string
          year: number | null
          poster_url: string | null
        }>(
          `SELECT ur.series_id, ur.rating, s.title, s.year, s.poster_url
           FROM user_ratings ur
           JOIN series s ON s.id = ur.series_id
           WHERE ur.user_id = $1 AND ur.series_id IS NOT NULL AND ur.rating <= 3
           ORDER BY s.title ASC`,
          [user.id]
        )

        for (const row of seriesResult.rows) {
          series.push({
            id: row.series_id,
            title: row.title,
            year: row.year,
            posterUrl: row.poster_url,
            rating: row.rating,
          })
        }
      }

      return reply.send({
        movies,
        series,
        totalCount: movies.length + series.length,
      })
    }
  )

  /**
   * GET /api/ratings/movie/:id
   * Get rating for a specific movie
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/ratings/movie/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params

      const rating = await queryOne<{ rating: number; source: string }>(
        `SELECT rating, source FROM user_ratings WHERE user_id = $1 AND movie_id = $2`,
        [user.id, id]
      )

      return reply.send({ rating: rating?.rating || null, source: rating?.source || null })
    }
  )

  /**
   * GET /api/ratings/series/:id
   * Get rating for a specific series
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/ratings/series/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params

      const rating = await queryOne<{ rating: number; source: string }>(
        `SELECT rating, source FROM user_ratings WHERE user_id = $1 AND series_id = $2`,
        [user.id, id]
      )

      return reply.send({ rating: rating?.rating || null, source: rating?.source || null })
    }
  )

  /**
   * POST /api/ratings/movie/:id
   * Rate a movie (1-10)
   */
  fastify.post<{ Params: { id: string }; Body: { rating: number } }>(
    '/api/ratings/movie/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params
      const { rating } = request.body

      // Validate rating
      if (!rating || rating < 1 || rating > 10 || !Number.isInteger(rating)) {
        return reply.status(400).send({ error: 'Rating must be an integer between 1 and 10' })
      }

      // Check if movie exists
      const movie = await queryOne<{ id: string }>('SELECT id FROM movies WHERE id = $1', [id])
      if (!movie) {
        return reply.status(404).send({ error: 'Movie not found' })
      }

      // Upsert rating
      await query(
        `INSERT INTO user_ratings (user_id, movie_id, rating, source)
         VALUES ($1, $2, $3, 'manual')
         ON CONFLICT (user_id, movie_id) WHERE movie_id IS NOT NULL
         DO UPDATE SET rating = EXCLUDED.rating, source = 'manual', updated_at = NOW()`,
        [user.id, id, rating]
      )

      // Push to Trakt if connected (async, don't wait)
      getUserTraktStatus(user.id).then(status => {
        if (status.connected) {
          pushRatingToTrakt(user.id, { movieId: id, rating }).catch(() => {
            // Silently fail - local rating is saved, Trakt sync will catch up later
          })
        }
      })

      return reply.send({ success: true, rating })
    }
  )

  /**
   * POST /api/ratings/series/:id
   * Rate a series (1-10)
   */
  fastify.post<{ Params: { id: string }; Body: { rating: number } }>(
    '/api/ratings/series/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params
      const { rating } = request.body

      // Validate rating
      if (!rating || rating < 1 || rating > 10 || !Number.isInteger(rating)) {
        return reply.status(400).send({ error: 'Rating must be an integer between 1 and 10' })
      }

      // Check if series exists
      const series = await queryOne<{ id: string }>('SELECT id FROM series WHERE id = $1', [id])
      if (!series) {
        return reply.status(404).send({ error: 'Series not found' })
      }

      // Upsert rating
      await query(
        `INSERT INTO user_ratings (user_id, series_id, rating, source)
         VALUES ($1, $2, $3, 'manual')
         ON CONFLICT (user_id, series_id) WHERE series_id IS NOT NULL
         DO UPDATE SET rating = EXCLUDED.rating, source = 'manual', updated_at = NOW()`,
        [user.id, id, rating]
      )

      // Push to Trakt if connected (async, don't wait)
      getUserTraktStatus(user.id).then(status => {
        if (status.connected) {
          pushRatingToTrakt(user.id, { seriesId: id, rating }).catch(() => {
            // Silently fail - local rating is saved, Trakt sync will catch up later
          })
        }
      })

      return reply.send({ success: true, rating })
    }
  )

  /**
   * DELETE /api/ratings/movie/:id
   * Remove rating for a movie
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/ratings/movie/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params

      await query(
        `DELETE FROM user_ratings WHERE user_id = $1 AND movie_id = $2`,
        [user.id, id]
      )

      // Remove from Trakt if connected (async, don't wait)
      getUserTraktStatus(user.id).then(status => {
        if (status.connected) {
          removeRatingFromTrakt(user.id, { movieId: id }).catch(() => {})
        }
      })

      return reply.send({ success: true })
    }
  )

  /**
   * DELETE /api/ratings/series/:id
   * Remove rating for a series
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/ratings/series/:id',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params

      await query(
        `DELETE FROM user_ratings WHERE user_id = $1 AND series_id = $2`,
        [user.id, id]
      )

      // Remove from Trakt if connected (async, don't wait)
      getUserTraktStatus(user.id).then(status => {
        if (status.connected) {
          removeRatingFromTrakt(user.id, { seriesId: id }).catch(() => {})
        }
      })

      return reply.send({ success: true })
    }
  )

  /**
   * POST /api/ratings/bulk
   * Bulk upsert ratings (used by Trakt sync)
   */
  fastify.post<{
    Body: {
      ratings: Array<{
        movieId?: string
        seriesId?: string
        rating: number
        source?: string
      }>
    }
  }>(
    '/api/ratings/bulk',
    { preHandler: requireAuth, schema: { tags: ['ratings'] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { ratings } = request.body

      if (!Array.isArray(ratings)) {
        return reply.status(400).send({ error: 'ratings must be an array' })
      }

      let inserted = 0
      let updated = 0
      let skipped = 0

      for (const r of ratings) {
        // Validate
        if (!r.rating || r.rating < 1 || r.rating > 10) {
          skipped++
          continue
        }

        if (r.movieId) {
          const result = await query(
            `INSERT INTO user_ratings (user_id, movie_id, rating, source)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, movie_id) WHERE movie_id IS NOT NULL
             DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
             RETURNING (xmax = 0) as is_insert`,
            [user.id, r.movieId, r.rating, r.source || 'trakt']
          )
          if (result.rows[0]?.is_insert) {
            inserted++
          } else {
            updated++
          }
        } else if (r.seriesId) {
          const result = await query(
            `INSERT INTO user_ratings (user_id, series_id, rating, source)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, series_id) WHERE series_id IS NOT NULL
             DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
             RETURNING (xmax = 0) as is_insert`,
            [user.id, r.seriesId, r.rating, r.source || 'trakt']
          )
          if (result.rows[0]?.is_insert) {
            inserted++
          } else {
            updated++
          }
        } else {
          skipped++
        }
      }

      return reply.send({ success: true, inserted, updated, skipped })
    }
  )
}

export default ratingsRoutes

