/**
 * Library statistics tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'

export function createLibraryTools(ctx: ToolContext) {
  return {
    getLibraryStats: tool({
      description:
        'Get comprehensive statistics about the user\'s media library. Use for "how many movies", "library size", etc.',
      parameters: z.object({}),
      execute: async () => {
        const movieStats = await queryOne<{
          count: string
          avg_rating: number
          total_runtime: string
        }>(
          `SELECT COUNT(*) as count, ROUND(AVG(community_rating)::numeric, 2) as avg_rating,
           SUM(runtime) as total_runtime FROM movies`
        )

        const seriesStats = await queryOne<{
          count: string
          episode_count: string
          avg_rating: number
        }>(
          `SELECT COUNT(DISTINCT s.id) as count, COUNT(e.id) as episode_count,
           ROUND(AVG(s.community_rating)::numeric, 2) as avg_rating
           FROM series s LEFT JOIN seasons sea ON sea.series_id = s.id
           LEFT JOIN episodes e ON e.season_id = sea.id`
        )

        const movieGenres = await query<{ genre: string; count: string }>(
          `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
           GROUP BY genre ORDER BY count DESC LIMIT 10`
        )

        const seriesGenres = await query<{ genre: string; count: string }>(
          `SELECT unnest(genres) as genre, COUNT(*) as count FROM series
           GROUP BY genre ORDER BY count DESC LIMIT 10`
        )

        const watchStats = await queryOne<{
          movies_watched: string
          episodes_watched: string
          total_plays: string
        }>(
          `SELECT COUNT(DISTINCT movie_id) FILTER (WHERE movie_id IS NOT NULL) as movies_watched,
           COUNT(DISTINCT episode_id) FILTER (WHERE episode_id IS NOT NULL) as episodes_watched,
           SUM(play_count) as total_plays FROM watch_history WHERE user_id = $1`,
          [ctx.userId]
        )

        const ratingStats = await queryOne<{ total_ratings: string; avg_rating: number }>(
          `SELECT COUNT(*) as total_ratings, ROUND(AVG(rating)::numeric, 1) as avg_rating
           FROM user_ratings WHERE user_id = $1`,
          [ctx.userId]
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

    getAvailableGenres: tool({
      description: 'Get a list of all available genres in the library with counts.',
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
      }),
      execute: async ({ type }) => {
        const genres: {
          movies?: Array<{ genre: string; count: number }>
          series?: Array<{ genre: string; count: number }>
        } = {}

        if (type === 'movies' || type === 'both') {
          const movieGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
             GROUP BY genre ORDER BY count DESC`
          )
          genres.movies = movieGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM series
             GROUP BY genre ORDER BY count DESC`
          )
          genres.series = seriesGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        return genres
      },
    }),
  }
}

