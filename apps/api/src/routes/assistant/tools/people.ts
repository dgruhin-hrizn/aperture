/**
 * People and studios tools with Tool UI output schemas
 */
import { tool } from 'ai'
import { nullSafe } from './utils.js'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'

export function createPeopleTools(ctx: ToolContext) {
  return {
    searchPeople: tool({
      description: 'Search for actors, directors, or writers. Returns filmography with images.',
      inputSchema: nullSafe(z.object({
        name: z.string().describe('Name of the person'),
        role: z.enum(['actor', 'director', 'writer', 'any']).optional().default('any'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ name, role = 'any', limit = 10 }) => {
        const people: Array<{
          name: string
          role: 'actor' | 'director' | 'writer'
          thumb: string | null
          filmography: Array<{
            id: string
            type: 'movie' | 'series'
            title: string
            year: number | null
            role: string | null
          }>
        }> = []

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
            [`%${name}%`, (limit ?? 10) * 5]
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
            [`%${name}%`, (limit ?? 10) * 5]
          )

          // Group by actor name
          const actorMap = new Map<
            string,
            {
              name: string
              thumb: string | null
              filmography: Array<{
                id: string
                type: 'movie' | 'series'
                title: string
                year: number | null
                role: string | null
              }>
            }
          >()

          for (const row of actorMovies.rows) {
            const existing = actorMap.get(row.actor_name) || {
              name: row.actor_name,
              thumb: row.actor_thumb,
              filmography: [],
            }
            existing.filmography.push({
              id: row.id,
              type: 'movie',
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
              filmography: [],
            }
            existing.filmography.push({
              id: row.id,
              type: 'series',
              title: row.title,
              year: row.year,
              role: row.actor_role,
            })
            actorMap.set(row.actor_name, existing)
          }

          for (const [, value] of actorMap) {
            people.push({ ...value, role: 'actor' })
          }
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
            [`%${name}%`, (limit ?? 10) * 5]
          )

          const directorMap = new Map<
            string,
            {
              name: string
              filmography: Array<{
                id: string
                type: 'movie' | 'series'
                title: string
                year: number | null
                role: string | null
              }>
            }
          >()

          for (const row of directorMovies.rows) {
            if (row.director.toLowerCase().includes(name.toLowerCase())) {
              const existing = directorMap.get(row.director) || {
                name: row.director,
                filmography: [],
              }
              existing.filmography.push({
                id: row.id,
                type: 'movie',
                title: row.title,
                year: row.year,
                role: 'Director',
              })
              directorMap.set(row.director, existing)
            }
          }

          for (const [, value] of directorMap) {
            people.push({ ...value, role: 'director', thumb: null })
          }
        }

        if (people.length === 0) {
          return {
            id: `people-empty-${Date.now()}`,
            people: [],
            error: `No one named "${name}" found in your library.`,
          }
        }

        return {
          id: `people-${Date.now()}`,
          people: people.slice(0, limit),
        }
      },
    }),

    getTopStudios: tool({
      description: "Get the user's most watched studios and networks.",
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ type = 'both', limit = 10 }) => {
        const result: {
          id: string
          studios?: Array<{
            name: string
            movieCount: number
            topTitles: Array<{ id: string; type: 'movie'; title: string }>
          }>
          networks?: Array<{
            name: string
            seriesCount: number
            topTitles: Array<{ id: string; type: 'series'; title: string }>
          }>
        } = { id: `studios-${Date.now()}` }

        if (type === 'movies' || type === 'both') {
          // Studios is now JSONB array of {id, name} objects
          const studioData = await query<{ studio: string; count: string }>(
            `SELECT studio_obj->>'name' as studio, COUNT(DISTINCT m.id) as count
             FROM movies m 
             JOIN watch_history wh ON wh.movie_id = m.id,
             LATERAL jsonb_array_elements(m.studios) as studio_obj
             WHERE wh.user_id = $1 AND studio_obj->>'name' IS NOT NULL
             GROUP BY studio_obj->>'name' ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const studios: Array<{
            name: string
            movieCount: number
            topTitles: Array<{ id: string; type: 'movie'; title: string }>
          }> = []

          for (const row of studioData.rows) {
            const topMovies = await query<{ id: string; title: string }>(
              `SELECT m.id, m.title FROM movies m 
               JOIN watch_history wh ON wh.movie_id = m.id
               WHERE wh.user_id = $1 
                 AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(m.studios) s 
                   WHERE s->>'name' = $2
                 )
               ORDER BY m.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.studio]
            )
            studios.push({
              name: row.studio,
              movieCount: parseInt(row.count),
              topTitles: topMovies.rows.map((m) => ({
                id: m.id,
                type: 'movie' as const,
                title: m.title,
              })),
            })
          }
          result.studios = studios
        }

        if (type === 'series' || type === 'both') {
          const networkData = await query<{ network: string; count: string }>(
            `SELECT s.network, COUNT(DISTINCT s.id) as count
             FROM series s JOIN episodes e ON e.series_id = s.id
             JOIN watch_history wh ON wh.episode_id = e.id
             WHERE wh.user_id = $1 AND s.network IS NOT NULL
             GROUP BY s.network ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const networks: Array<{
            name: string
            seriesCount: number
            topTitles: Array<{ id: string; type: 'series'; title: string }>
          }> = []

          for (const row of networkData.rows) {
            const topSeries = await query<{ id: string; title: string }>(
              `SELECT DISTINCT s.id, s.title FROM series s
               JOIN episodes e ON e.series_id = s.id
               JOIN watch_history wh ON wh.episode_id = e.id
               WHERE wh.user_id = $1 AND s.network = $2
               ORDER BY s.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.network]
            )
            networks.push({
              name: row.network,
              seriesCount: parseInt(row.count),
              topTitles: topSeries.rows.map((s) => ({
                id: s.id,
                type: 'series' as const,
                title: s.title,
              })),
            })
          }
          result.networks = networks
        }

        return result
      },
    }),
  }
}
