/**
 * Movie Franchises Handler
 * 
 * GET /api/movies/franchises - Get franchises with their movies and watch progress
 */
import type { FastifyInstance } from 'fastify'
import { query } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { franchisesSchema } from '../schemas.js'
import type { FranchisesQuerystring } from '../types.js'

export function registerFranchisesHandler(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: FranchisesQuerystring
  }>(
    '/api/movies/franchises',
    {
      preHandler: requireAuth,
      schema: franchisesSchema,
    },
    async (request, reply) => {
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
    }
  )
}
