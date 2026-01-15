/**
 * Content details tool with Tool UI output schema
 */
import { tool } from 'ai'
import { nullSafe } from './utils.js'
import { z } from 'zod'
import { queryOne } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ContentDetail } from '../schemas/index.js'

export function createContentTools(ctx: ToolContext) {
  return {
    getContentDetails: tool({
      description:
        'Get comprehensive details about a specific movie or TV series including play link, cast, and more.',
      inputSchema: nullSafe(z.object({
        title: z.string().describe('The title to get details for'),
      })),
      execute: async ({ title }): Promise<ContentDetail | { id: string; error: string }> => {
        try {
          // Try movie first
          const movie = await queryOne<{
            id: string
            title: string
            year: number | null
            genres: string[]
            overview: string | null
            community_rating: number | null
            poster_url: string | null
            provider_item_id: string | null
            runtime_minutes: number | null
            directors: string[] | null
            actors: Array<{ name: string; role?: string; thumb?: string }> | null
            tagline: string | null
            content_rating: string | null
            critic_rating: number | null
          }>(
            `SELECT id, title, year, genres, overview, community_rating, poster_url,
           provider_item_id, runtime_minutes, directors, actors, tagline, content_rating, critic_rating
           FROM movies WHERE title ILIKE $1 LIMIT 1`,
            [`%${title}%`]
          )

          if (movie) {
            const playLink = buildPlayLink(ctx.mediaServer, movie.provider_item_id, 'movie')
            const runtimeHours = movie.runtime_minutes ? Math.floor(movie.runtime_minutes / 60) : 0
            const runtimeMins = movie.runtime_minutes ? movie.runtime_minutes % 60 : 0

            const userRating = await queryOne<{ rating: number }>(
              `SELECT rating FROM user_ratings WHERE user_id = $1 AND movie_id = $2`,
              [ctx.userId, movie.id]
            )

            const watchStatus = await queryOne<{ play_count: number; last_played_at: Date }>(
              `SELECT play_count, last_played_at FROM watch_history WHERE user_id = $1 AND movie_id = $2`,
              [ctx.userId, movie.id]
            )

            const actions: Array<{
              id: string
              label: string
              href: string
              variant: 'default' | 'secondary' | 'primary'
            }> = [
              {
                id: 'details',
                label: 'View Details',
                href: `/movies/${movie.id}`,
                variant: 'secondary',
              },
            ]
            if (playLink) {
              actions.push({
                id: 'play',
                label: 'Play on Emby',
                href: playLink,
                variant: 'primary',
              })
            }

            return {
              id: `detail-${movie.id}`,
              type: 'movie',
              contentId: movie.id,
              name: movie.title,
              year: movie.year,
              tagline: movie.tagline,
              overview: movie.overview,
              genres: movie.genres,
              image: movie.poster_url,
              runtime: movie.runtime_minutes ? `${runtimeHours}h ${runtimeMins}m` : null,
              director: movie.directors?.join(', ') || null,
              cast: movie.actors?.slice(0, 10).map((a) => a.name),
              communityRating: movie.community_rating,
              criticRating: movie.critic_rating,
              contentRating: movie.content_rating,
              userRating: userRating?.rating || null,
              isWatched: !!watchStatus,
              playCount: watchStatus?.play_count || 0,
              lastWatched: watchStatus?.last_played_at?.toISOString() || null,
              actions,
            }
          }

          // Try series
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
           FROM series WHERE title ILIKE $1 LIMIT 1`,
            [`%${title}%`]
          )

          if (series) {
            const playLink = buildPlayLink(ctx.mediaServer, series.provider_item_id, 'series')

            const counts = await queryOne<{ season_count: string; episode_count: string }>(
              `SELECT COUNT(DISTINCT e.season_number) as season_count, COUNT(e.id) as episode_count
             FROM episodes e
             WHERE e.series_id = $1`,
              [series.id]
            )

            const userRating = await queryOne<{ rating: number }>(
              `SELECT rating FROM user_ratings WHERE user_id = $1 AND series_id = $2`,
              [ctx.userId, series.id]
            )

            const watchStatus = await queryOne<{ episodes_watched: string }>(
              `SELECT COUNT(DISTINCT wh.episode_id) as episodes_watched
             FROM watch_history wh JOIN episodes e ON e.id = wh.episode_id
             WHERE wh.user_id = $1 AND e.series_id = $2`,
              [ctx.userId, series.id]
            )

            const yearRange = series.end_year
              ? `${series.year} – ${series.end_year}`
              : series.year
                ? `${series.year} – Present`
                : null

            const actions: Array<{
              id: string
              label: string
              href: string
              variant: 'default' | 'secondary' | 'primary'
            }> = [
              {
                id: 'details',
                label: 'View Details',
                href: `/series/${series.id}`,
                variant: 'secondary',
              },
            ]
            if (playLink) {
              actions.push({
                id: 'play',
                label: 'Play on Emby',
                href: playLink,
                variant: 'primary',
              })
            }

            return {
              id: `detail-${series.id}`,
              type: 'series',
              contentId: series.id,
              name: series.title,
              year: series.year,
              yearRange,
              overview: series.overview,
              genres: series.genres,
              image: series.poster_url,
              network: series.network,
              status: series.status,
              seasonCount: parseInt(counts?.season_count || '0'),
              episodeCount: parseInt(counts?.episode_count || '0'),
              communityRating: series.community_rating,
              criticRating: series.critic_rating,
              contentRating: series.content_rating,
              userRating: userRating?.rating || null,
              episodesWatched: parseInt(watchStatus?.episodes_watched || '0'),
              actions,
            }
          }

          return { id: `error-${Date.now()}`, error: `"${title}" not found in your library.` }
        } catch (err) {
          console.error('[getContentDetails] Error:', err)
          return {
            id: `error-${Date.now()}`,
            error: `Failed to get content details: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }
        }
      },
    }),
  }
}
