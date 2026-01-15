/**
 * Library statistics tools with Tool UI output schemas
 */
import { tool } from 'ai'
import { nullSafe } from './utils.js'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ToolContext } from '../types.js'

export function createLibraryTools(ctx: ToolContext) {
  return {
    getContentRankings: tool({
      description:
        'Get content rankings/leaderboards. Use for questions like "which series has the most episodes", "longest movie", "highest rated series", "oldest movie", etc.',
      inputSchema: nullSafe(z.object({
        rankBy: z
          .enum([
            'most_episodes',
            'longest_runtime',
            'highest_rated',
            'lowest_rated',
            'newest',
            'oldest',
            'most_seasons',
          ])
          .describe('What to rank by'),
        type: z.enum(['movies', 'series']).describe('Content type to rank'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ rankBy, type, limit = 10 }) => {
        if (type === 'series') {
          if (rankBy === 'most_episodes') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              episode_count: string
            }>(
              `SELECT s.id, s.title, s.year, s.poster_url, s.provider_item_id,
               COUNT(e.id) as episode_count
               FROM series s LEFT JOIN episodes e ON e.series_id = s.id
               GROUP BY s.id ORDER BY episode_count DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: 'Series with Most Episodes',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${parseInt(r.episode_count)} episodes`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'most_seasons') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              season_count: string
            }>(
              `SELECT s.id, s.title, s.year, s.poster_url, s.provider_item_id,
               COUNT(DISTINCT e.season_number) as season_count
               FROM series s LEFT JOIN episodes e ON e.series_id = s.id
               GROUP BY s.id ORDER BY season_count DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: 'Series with Most Seasons',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${parseInt(r.season_count)} seasons`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'highest_rated' || rankBy === 'lowest_rated') {
            const order = rankBy === 'highest_rated' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              community_rating: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, community_rating
               FROM series WHERE community_rating IS NOT NULL
               ORDER BY community_rating ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: rankBy === 'highest_rated' ? 'Highest Rated Series' : 'Lowest Rated Series',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.community_rating} rating`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'newest' || rankBy === 'oldest') {
            const order = rankBy === 'newest' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
            }>(
              `SELECT id, title, year, poster_url, provider_item_id
               FROM series WHERE year IS NOT NULL
               ORDER BY year ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: rankBy === 'newest' ? 'Newest Series' : 'Oldest Series',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.year}`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }
        }

        if (type === 'movies') {
          if (rankBy === 'longest_runtime') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              runtime_minutes: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, runtime_minutes
               FROM movies WHERE runtime_minutes IS NOT NULL
               ORDER BY runtime_minutes DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: 'Longest Movies',
              items: results.rows.map((r, i) => {
                const hours = Math.floor(r.runtime_minutes / 60)
                const mins = r.runtime_minutes % 60
                return {
                  rank: i + 1,
                  id: r.id,
                  type: 'movie',
                  name: r.title,
                  year: r.year,
                  image: r.poster_url,
                  value: `${hours}h ${mins}m`,
                  detailsUrl: `/movies/${r.id}`,
                  playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
                }
              }),
            }
          }

          if (rankBy === 'highest_rated' || rankBy === 'lowest_rated') {
            const order = rankBy === 'highest_rated' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              community_rating: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, community_rating
               FROM movies WHERE community_rating IS NOT NULL
               ORDER BY community_rating ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: rankBy === 'highest_rated' ? 'Highest Rated Movies' : 'Lowest Rated Movies',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'movie',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.community_rating} rating`,
                detailsUrl: `/movies/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
              })),
            }
          }

          if (rankBy === 'newest' || rankBy === 'oldest') {
            const order = rankBy === 'newest' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
            }>(
              `SELECT id, title, year, poster_url, provider_item_id
               FROM movies WHERE year IS NOT NULL
               ORDER BY year ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              title: rankBy === 'newest' ? 'Newest Movies' : 'Oldest Movies',
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'movie',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.year}`,
                detailsUrl: `/movies/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
              })),
            }
          }
        }

        return {
          id: `ranking-error-${Date.now()}`,
          error: `Invalid combination: ${rankBy} for ${type}`,
        }
      },
    }),

    getLibraryStats: tool({
      description:
        'Get comprehensive statistics about the user\'s media library. Use for "how many movies", "library size", etc.',
      inputSchema: nullSafe(z.object({})),
      execute: async () => {
        const movieStats = await queryOne<{
          count: string
          avg_rating: number
          total_runtime: string
        }>(
          `SELECT COUNT(*) as count, ROUND(AVG(community_rating)::numeric, 2) as avg_rating,
           SUM(runtime_minutes) as total_runtime FROM movies`
        )

        const seriesStats = await queryOne<{
          count: string
          episode_count: string
          avg_rating: number
        }>(
          `SELECT COUNT(DISTINCT s.id) as count, COUNT(e.id) as episode_count,
           ROUND(AVG(s.community_rating)::numeric, 2) as avg_rating
           FROM series s LEFT JOIN episodes e ON e.series_id = s.id`
        )

        const movieGenres = await query<{ genre: string; count: string }>(
          `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
           GROUP BY genre ORDER BY count DESC LIMIT 10`
        )

        const watchStats = await queryOne<{
          movies_watched: string
          series_started: string
          total_plays: string
        }>(
          `SELECT 
           COUNT(DISTINCT movie_id) FILTER (WHERE movie_id IS NOT NULL) as movies_watched,
           COUNT(DISTINCT (SELECT e2.series_id FROM episodes e2 WHERE e2.id = wh.episode_id)) FILTER (WHERE episode_id IS NOT NULL) as series_started,
           SUM(play_count) as total_plays 
           FROM watch_history wh WHERE user_id = $1`,
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
          id: `stats-${Date.now()}`,
          movieCount: parseInt(movieStats?.count || '0'),
          seriesCount: parseInt(seriesStats?.count || '0'),
          episodeCount: parseInt(seriesStats?.episode_count || '0'),
          totalRuntimeMinutes: totalRuntime,
          totalRuntimeFormatted: `${days} days, ${hours} hours`,
          averageRating: movieStats?.avg_rating || null,
          topGenres: movieGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          })),
          watchStats: {
            moviesWatched: parseInt(watchStats?.movies_watched || '0'),
            seriesStarted: parseInt(watchStats?.series_started || '0'),
            totalPlayCount: parseInt(watchStats?.total_plays || '0'),
          },
          ratingStats: {
            totalRated: parseInt(ratingStats?.total_ratings || '0'),
            averageUserRating: ratingStats?.avg_rating || null,
          },
        }
      },
    }),

    getAvailableGenres: tool({
      description: 'Get a list of all available genres in the library with counts.',
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
      })),
      execute: async ({ type }) => {
        const result: {
          id: string
          movieGenres?: Array<{ genre: string; count: number }>
          seriesGenres?: Array<{ genre: string; count: number }>
        } = { id: `genres-${Date.now()}` }

        if (type === 'movies' || type === 'both') {
          const movieGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
             GROUP BY genre ORDER BY count DESC`
          )
          result.movieGenres = movieGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM series
             GROUP BY genre ORDER BY count DESC`
          )
          result.seriesGenres = seriesGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        return result
      },
    }),
  }
}
