/**
 * Content details tool
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'
import { buildPlayLink } from '../helpers/mediaServer.js'

export function createContentTools(ctx: ToolContext) {
  return {
    getContentDetails: tool({
      description:
        'Get comprehensive details about a specific movie or TV series including play link, cast, and more.',
      parameters: z.object({
        title: z.string().describe('The title to get details for'),
      }),
      execute: async ({ title }) => {
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
          runtime: number | null
          director: string | null
          cast: string[] | null
          tagline: string | null
          content_rating: string | null
          critic_rating: number | null
        }>(
          `SELECT id, title, year, genres, overview, community_rating, poster_url,
           provider_item_id, runtime, director, cast, tagline, content_rating, critic_rating
           FROM movies WHERE title ILIKE $1 LIMIT 1`,
          [`%${title}%`]
        )

        if (movie) {
          const playLink = buildPlayLink(ctx.mediaServer, movie.provider_item_id, 'movie')
          const runtimeHours = movie.runtime ? Math.floor(movie.runtime / 60) : 0
          const runtimeMins = movie.runtime ? movie.runtime % 60 : 0

          const userRating = await queryOne<{ rating: number }>(
            `SELECT rating FROM user_ratings WHERE user_id = $1 AND movie_id = $2`,
            [ctx.userId, movie.id]
          )

          const watchStatus = await queryOne<{ play_count: number; last_played_at: Date }>(
            `SELECT play_count, last_played_at FROM watch_history WHERE user_id = $1 AND movie_id = $2`,
            [ctx.userId, movie.id]
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
            cast: movie.cast?.slice(0, 10),
            runtime: movie.runtime ? `${runtimeHours}h ${runtimeMins}m` : null,
            communityRating: movie.community_rating,
            criticRating: movie.critic_rating,
            contentRating: movie.content_rating,
            posterUrl: movie.poster_url,
            playLink,
            mediaServerType: ctx.mediaServer?.type || null,
            userRating: userRating?.rating || null,
            isWatched: !!watchStatus,
            playCount: watchStatus?.play_count || 0,
            lastWatched: watchStatus?.last_played_at || null,
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
            `SELECT COUNT(DISTINCT sea.id) as season_count, COUNT(e.id) as episode_count
             FROM seasons sea LEFT JOIN episodes e ON e.season_id = sea.id
             WHERE sea.series_id = $1`,
            [series.id]
          )

          const userRating = await queryOne<{ rating: number }>(
            `SELECT rating FROM user_ratings WHERE user_id = $1 AND series_id = $2`,
            [ctx.userId, series.id]
          )

          const watchStatus = await queryOne<{ episodes_watched: string }>(
            `SELECT COUNT(DISTINCT wh.episode_id) as episodes_watched
             FROM watch_history wh JOIN episodes e ON e.id = wh.episode_id
             JOIN seasons sea ON sea.id = e.season_id
             WHERE wh.user_id = $1 AND sea.series_id = $2`,
            [ctx.userId, series.id]
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
            mediaServerType: ctx.mediaServer?.type || null,
            userRating: userRating?.rating || null,
            episodesWatched: parseInt(watchStatus?.episodes_watched || '0'),
          }
        }

        return { error: `"${title}" not found in your library.` }
      },
    }),
  }
}

