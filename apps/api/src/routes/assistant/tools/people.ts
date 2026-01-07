/**
 * People and studios tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'

export function createPeopleTools(ctx: ToolContext) {
  return {
    searchPeople: tool({
      description: 'Search for actors, directors, or writers. Returns filmography with images.',
      parameters: z.object({
        name: z.string().describe('Name of the person'),
        role: z.enum(['actor', 'director', 'writer', 'any']).optional().default('any'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ name, role = 'any', limit = 10 }) => {
        const results: {
          actors?: Array<{
            name: string
            thumb: string | null
            movies: Array<{ id: string; title: string; year: number | null; role: string | null }>
            series: Array<{ id: string; title: string; year: number | null; role: string | null }>
          }>
          directors?: Array<{
            name: string
            movies: Array<{ id: string; title: string; year: number | null }>
            series: Array<{ id: string; title: string; year: number | null }>
          }>
        } = {}

        if (role === 'actor' || role === 'any') {
          const actorMovies = await query<{
            id: string
            actor_name: string
            actor_thumb: string | null
            actor_role: string | null
            title: string
            year: number | null
          }>(
            `SELECT m.id, actor->>'name' as actor_name, actor->>'thumb' as actor_thumb,
             actor->>'role' as actor_role, m.title, m.year
             FROM movies m, LATERAL jsonb_array_elements(m.actors) as actor
             WHERE actor->>'name' ILIKE $1
             ORDER BY m.year DESC NULLS LAST LIMIT $2`,
            [`%${name}%`, limit * 5]
          )

          const actorSeries = await query<{
            id: string
            actor_name: string
            actor_thumb: string | null
            actor_role: string | null
            title: string
            year: number | null
          }>(
            `SELECT s.id, actor->>'name' as actor_name, actor->>'thumb' as actor_thumb,
             actor->>'role' as actor_role, s.title, s.year
             FROM series s, LATERAL jsonb_array_elements(s.actors) as actor
             WHERE actor->>'name' ILIKE $1
             ORDER BY s.year DESC NULLS LAST LIMIT $2`,
            [`%${name}%`, limit * 5]
          )

          const actorMap = new Map<
            string,
            {
              name: string
              thumb: string | null
              movies: Array<{ id: string; title: string; year: number | null; role: string | null }>
              series: Array<{ id: string; title: string; year: number | null; role: string | null }>
            }
          >()

          for (const row of actorMovies.rows) {
            const existing = actorMap.get(row.actor_name) || {
              name: row.actor_name,
              thumb: row.actor_thumb,
              movies: [],
              series: [],
            }
            existing.movies.push({
              id: row.id,
              title: row.title,
              year: row.year,
              role: row.actor_role,
            })
            actorMap.set(row.actor_name, existing)
          }

          for (const row of actorSeries.rows) {
            const existing = actorMap.get(row.actor_name) || {
              name: row.actor_name,
              thumb: row.actor_thumb,
              movies: [],
              series: [],
            }
            existing.series.push({
              id: row.id,
              title: row.title,
              year: row.year,
              role: row.actor_role,
            })
            actorMap.set(row.actor_name, existing)
          }

          results.actors = Array.from(actorMap.values()).slice(0, limit)
        }

        if (role === 'director' || role === 'any') {
          const directorMovies = await query<{
            id: string
            director: string
            title: string
            year: number | null
          }>(
            `SELECT id, unnest(directors) as director, title, year FROM movies
             WHERE EXISTS (SELECT 1 FROM unnest(directors) d WHERE d ILIKE $1)
             ORDER BY year DESC NULLS LAST LIMIT $2`,
            [`%${name}%`, limit * 5]
          )

          const directorMap = new Map<
            string,
            {
              name: string
              movies: Array<{ id: string; title: string; year: number | null }>
              series: Array<{ id: string; title: string; year: number | null }>
            }
          >()

          for (const row of directorMovies.rows) {
            if (row.director.toLowerCase().includes(name.toLowerCase())) {
              const existing = directorMap.get(row.director) || {
                name: row.director,
                movies: [],
                series: [],
              }
              existing.movies.push({ id: row.id, title: row.title, year: row.year })
              directorMap.set(row.director, existing)
            }
          }

          results.directors = Array.from(directorMap.values()).slice(0, limit)
        }

        const totalFound = (results.actors?.length || 0) + (results.directors?.length || 0)
        if (totalFound === 0) {
          return { error: `No one named "${name}" found in your library.` }
        }
        return results
      },
    }),

    getTopStudios: tool({
      description: "Get the user's most watched studios and networks.",
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type = 'both', limit = 10 }) => {
        const results: {
          studios?: Array<{
            name: string
            movieCount: number
            topMovies: Array<{ id: string; title: string }>
          }>
          networks?: Array<{
            name: string
            seriesCount: number
            topSeries: Array<{ id: string; title: string }>
          }>
        } = {}

        if (type === 'movies' || type === 'both') {
          const studioData = await query<{ studio: string; count: string }>(
            `SELECT unnest(m.studios) as studio, COUNT(DISTINCT m.id) as count
             FROM movies m JOIN watch_history wh ON wh.movie_id = m.id
             WHERE wh.user_id = $1
             GROUP BY studio ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const studios: Array<{
            name: string
            movieCount: number
            topMovies: Array<{ id: string; title: string }>
          }> = []
          for (const row of studioData.rows) {
            const topMovies = await query<{ id: string; title: string }>(
              `SELECT m.id, m.title FROM movies m JOIN watch_history wh ON wh.movie_id = m.id
               WHERE wh.user_id = $1 AND $2 = ANY(m.studios)
               ORDER BY m.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.studio]
            )
            studios.push({
              name: row.studio,
              movieCount: parseInt(row.count),
              topMovies: topMovies.rows.map((m) => ({ id: m.id, title: m.title })),
            })
          }
          results.studios = studios
        }

        if (type === 'series' || type === 'both') {
          const networkData = await query<{ network: string; count: string }>(
            `SELECT s.network, COUNT(DISTINCT s.id) as count
             FROM series s JOIN seasons sea ON sea.series_id = s.id
             JOIN episodes e ON e.season_id = sea.id
             JOIN watch_history wh ON wh.episode_id = e.id
             WHERE wh.user_id = $1 AND s.network IS NOT NULL
             GROUP BY s.network ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const networks: Array<{
            name: string
            seriesCount: number
            topSeries: Array<{ id: string; title: string }>
          }> = []
          for (const row of networkData.rows) {
            const topSeries = await query<{ id: string; title: string }>(
              `SELECT DISTINCT s.id, s.title FROM series s
               JOIN seasons sea ON sea.series_id = s.id
               JOIN episodes e ON e.season_id = sea.id
               JOIN watch_history wh ON wh.episode_id = e.id
               WHERE wh.user_id = $1 AND s.network = $2
               ORDER BY s.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.network]
            )
            networks.push({
              name: row.network,
              seriesCount: parseInt(row.count),
              topSeries: topSeries.rows.map((s) => ({ id: s.id, title: s.title })),
            })
          }
          results.networks = networks
        }

        return results
      },
    }),
  }
}
