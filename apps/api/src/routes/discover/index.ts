/**
 * Discovery Routes
 * Browse content by person (actors/directors) or studio/network
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  listPeopleForBrowse,
  resolveTmdbPersonProfileImageUrl,
  getPersonCreditsGap,
  findPersonMediaServerItemIdForName,
  pushImageToMediaServer,
} from '@aperture/core'
import { query, queryOne } from '../../lib/db.js'
import { requireAuth, requireAdmin } from '../../plugins/auth.js'
import { discoverSchemas, getPeopleListSchema } from './schemas.js'
import { registerTmdbExternalDetailRoutes } from './tmdbExternalDetail.js'

interface ContentItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  communityRating: number | null
  role?: string // For actors - their role in this content
}

interface PersonResponse {
  name: string
  imageUrl: string | null
  /** TMDb profile URL when media server has no portrait (optional eager load). */
  tmdbFallbackImageUrl?: string | null
  movies: ContentItem[]
  series: ContentItem[]
  stats: {
    totalMovies: number
    totalSeries: number
    asActor: number
    asDirector: number
  }
}

interface StudioResponse {
  name: string
  imageUrl: string | null
  movies: ContentItem[]
  series: ContentItem[]
  stats: {
    totalMovies: number
    totalSeries: number
  }
}

const discoverRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(discoverSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  registerTmdbExternalDetailRoutes(fastify)

  /**
   * GET /api/discover/people
   * Paginated list of distinct people (actors + directors) in the library
   */
  fastify.get<{
    Querystring: {
      search?: string
      page?: string
      pageSize?: string
      sortBy?: string
      showAll?: string
    }
  }>(
    '/api/discover/people',
    { preHandler: requireAuth, schema: getPeopleListSchema },
    async (request) => {
      const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1)
      const pageSize = Math.min(
        Math.max(1, parseInt(request.query.pageSize || '50', 10) || 50),
        50
      )
      const sortBy = request.query.sortBy === 'credits' ? 'credits' : 'name'
      const search = request.query.search?.trim() || undefined
      const showAll = request.query.showAll === 'true'

      return listPeopleForBrowse({
        page,
        pageSize,
        sortBy,
        search,
        showAll,
      })
    }
  )

  /**
   * GET /api/discover/person-profile?name=...
   * TMDb profile image URL for lazy UI fallback (cache-backed).
   */
  fastify.get<{
    Querystring: { name?: string }
  }>(
    '/api/discover/person-profile',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const raw = request.query.name?.trim()
      if (!raw) {
        return reply.status(400).send({ error: 'Missing name query parameter' })
      }
      const decodedName = decodeURIComponent(raw)
      const { imageUrl, tmdbPersonId } = await resolveTmdbPersonProfileImageUrl(decodedName)
      request.log.info(
        {
          route: 'person-profile',
          name: decodedName,
          hasImageUrl: !!imageUrl,
          tmdbPersonId,
        },
        'TMDb person profile fallback lookup'
      )
      return reply.send({ imageUrl })
    }
  )

  /**
   * GET /api/discover/person/:name/credits-gap
   * TMDb combined credits vs visible library (missing titles).
   */
  fastify.get<{
    Params: { name: string }
    Querystring: { showAll?: string; maxMissing?: string }
  }>(
    '/api/discover/person/:name/credits-gap',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const decodedName = decodeURIComponent(request.params.name)
      const showAll = request.query.showAll === 'true'
      const maxMissing = request.query.maxMissing
        ? parseInt(request.query.maxMissing, 10)
        : undefined
      const gap = await getPersonCreditsGap(decodedName, {
        showAll,
        maxMissing: Number.isFinite(maxMissing) ? maxMissing : undefined,
      })
      return reply.send(gap)
    }
  )

  /**
   * POST /api/discover/person/:name/push-tmdb-portrait
   * Admin: download TMDb portrait and push Primary image to media server (requires synced personId on actors).
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/discover/person/:name/push-tmdb-portrait',
    { preHandler: [requireAuth, requireAdmin], schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const decodedName = decodeURIComponent(request.params.name)
      const itemId = await findPersonMediaServerItemIdForName(decodedName)
      if (!itemId) {
        return reply.status(400).send({
          error: 'No media server Person item id',
          message:
            'Re-sync movies/series so actors include personId from Jellyfin/Emby, or the name does not match cast entries.',
        })
      }

      const { imageUrl } = await resolveTmdbPersonProfileImageUrl(decodedName)
      if (!imageUrl) {
        return reply.status(404).send({
          error: 'No TMDb profile image',
          message: 'Could not resolve a TMDb portrait for this person.',
        })
      }

      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) })
      if (!imgRes.ok) {
        return reply.status(502).send({ error: 'Failed to download TMDb image' })
      }
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const result = await pushImageToMediaServer(itemId, 'Primary', buf, contentType)
      if (!result.success) {
        return reply.status(500).send({
          error: result.error || 'Failed to push image to media server',
        })
      }
      return reply.send({ success: true, itemId })
    }
  )

  /**
   * GET /api/discover/person/:name
   * Get all movies and series featuring a person (actor or director)
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/discover/person/:name',
    { preHandler: requireAuth, schema: { tags: ["discovery"] } },
    async (request, reply) => {
      const { name } = request.params
      const decodedName = decodeURIComponent(name)

      // Query movies where person is actor or director
      const movieResults = await query<{
        id: string
        title: string
        year: number | null
        poster_url: string | null
        backdrop_url: string | null
        genres: string[]
        community_rating: number | null
        is_actor: boolean
        is_director: boolean
        role: string | null
      }>(
        `SELECT 
          m.id,
          m.title,
          m.year,
          m.poster_url,
          m.backdrop_url,
          m.genres,
          m.community_rating,
          EXISTS(
            SELECT 1 FROM jsonb_array_elements(m.actors) AS a 
            WHERE a->>'name' ILIKE $1
          ) as is_actor,
          $1 = ANY(m.directors) as is_director,
          (
            SELECT a->>'role' FROM jsonb_array_elements(m.actors) AS a 
            WHERE a->>'name' ILIKE $1
            LIMIT 1
          ) as role
        FROM movies m
        WHERE 
          EXISTS(SELECT 1 FROM jsonb_array_elements(m.actors) AS a WHERE a->>'name' ILIKE $1)
          OR $1 = ANY(m.directors)
        ORDER BY m.year DESC NULLS LAST, m.title ASC`,
        [decodedName]
      )

      // Query series where person is actor or director
      const seriesResults = await query<{
        id: string
        title: string
        year: number | null
        poster_url: string | null
        backdrop_url: string | null
        genres: string[]
        community_rating: number | null
        is_actor: boolean
        is_director: boolean
        role: string | null
      }>(
        `SELECT 
          s.id,
          s.title,
          s.year,
          s.poster_url,
          s.backdrop_url,
          s.genres,
          s.community_rating,
          EXISTS(
            SELECT 1 FROM jsonb_array_elements(s.actors) AS a 
            WHERE a->>'name' ILIKE $1
          ) as is_actor,
          $1 = ANY(s.directors) as is_director,
          (
            SELECT a->>'role' FROM jsonb_array_elements(s.actors) AS a 
            WHERE a->>'name' ILIKE $1
            LIMIT 1
          ) as role
        FROM series s
        WHERE 
          EXISTS(SELECT 1 FROM jsonb_array_elements(s.actors) AS a WHERE a->>'name' ILIKE $1)
          OR $1 = ANY(s.directors)
        ORDER BY s.year DESC NULLS LAST, s.title ASC`,
        [decodedName]
      )

      // Build person image URL through our proxy
      const imageUrl = `/api/media/images/Persons/${encodeURIComponent(decodedName)}/Images/Primary`

      // Count stats
      const asActorMovies = movieResults.rows.filter(r => r.is_actor).length
      const asDirectorMovies = movieResults.rows.filter(r => r.is_director).length
      const asActorSeries = seriesResults.rows.filter(r => r.is_actor).length
      const asDirectorSeries = seriesResults.rows.filter(r => r.is_director).length

      const tmdbProfile = await resolveTmdbPersonProfileImageUrl(decodedName)

      const response: PersonResponse = {
        name: decodedName,
        imageUrl,
        tmdbFallbackImageUrl: tmdbProfile.imageUrl,
        movies: movieResults.rows.map(r => ({
          id: r.id,
          title: r.title,
          year: r.year,
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          genres: r.genres || [],
          communityRating: r.community_rating,
          role: r.role || undefined,
        })),
        series: seriesResults.rows.map(r => ({
          id: r.id,
          title: r.title,
          year: r.year,
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          genres: r.genres || [],
          communityRating: r.community_rating,
          role: r.role || undefined,
        })),
        stats: {
          totalMovies: movieResults.rows.length,
          totalSeries: seriesResults.rows.length,
          asActor: asActorMovies + asActorSeries,
          asDirector: asDirectorMovies + asDirectorSeries,
        },
      }

      return reply.send(response)
    }
  )

  /**
   * GET /api/discover/studio/:name
   * Get all movies and series from a studio or network
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/discover/studio/:name',
    { preHandler: requireAuth, schema: { tags: ["discovery"] } },
    async (request, reply) => {
      const { name } = request.params
      const decodedName = decodeURIComponent(name)

      // Query movies from this studio
      const movieResults = await query<{
        id: string
        title: string
        year: number | null
        poster_url: string | null
        backdrop_url: string | null
        genres: string[]
        community_rating: number | null
      }>(
        `SELECT 
          m.id,
          m.title,
          m.year,
          m.poster_url,
          m.backdrop_url,
          m.genres,
          m.community_rating
        FROM movies m
        WHERE EXISTS(
          SELECT 1 FROM jsonb_array_elements(m.studios) AS s 
          WHERE s->>'name' ILIKE $1
        )
        ORDER BY m.year DESC NULLS LAST, m.title ASC`,
        [decodedName]
      )

      // Query series from this studio OR network
      const seriesResults = await query<{
        id: string
        title: string
        year: number | null
        poster_url: string | null
        backdrop_url: string | null
        genres: string[]
        community_rating: number | null
      }>(
        `SELECT 
          s.id,
          s.title,
          s.year,
          s.poster_url,
          s.backdrop_url,
          s.genres,
          s.community_rating
        FROM series s
        WHERE 
          EXISTS(
            SELECT 1 FROM jsonb_array_elements(s.studios) AS st 
            WHERE st->>'name' ILIKE $1
          )
          OR s.network ILIKE $1
        ORDER BY s.year DESC NULLS LAST, s.title ASC`,
        [decodedName]
      )

      // Check if we have logo data from TMDB enrichment or Emby ID for fallback
      // Check both 'studio' and 'network' types since this page handles both
      const studioLogo = await queryOne<{ 
        logo_local_path: string | null
        logo_path: string | null
        emby_id: string | null 
      }>(
        `SELECT logo_local_path, logo_path, emby_id FROM studios_networks 
         WHERE name ILIKE $1
         ORDER BY logo_local_path IS NOT NULL DESC, logo_path IS NOT NULL DESC
         LIMIT 1`,
        [decodedName]
      )

      // Use local logo if available, then TMDB, then Emby ID, then name-based fallback
      let imageUrl: string | null = null
      if (studioLogo?.logo_local_path) {
        imageUrl = `/api/uploads/${studioLogo.logo_local_path}`
      } else if (studioLogo?.logo_path) {
        imageUrl = `https://image.tmdb.org/t/p/w185${studioLogo.logo_path}`
      } else if (studioLogo?.emby_id) {
        // Use Emby/Jellyfin item ID for the image
        imageUrl = `/api/media/images/Items/${studioLogo.emby_id}/Images/Thumb`
      } else {
        // Last resort: try by name (may not work on all media servers)
        imageUrl = `/api/media/images/Studios/${encodeURIComponent(decodedName)}/Images/Primary`
      }

      const response: StudioResponse = {
        name: decodedName,
        imageUrl,
        movies: movieResults.rows.map(r => ({
          id: r.id,
          title: r.title,
          year: r.year,
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          genres: r.genres || [],
          communityRating: r.community_rating,
        })),
        series: seriesResults.rows.map(r => ({
          id: r.id,
          title: r.title,
          year: r.year,
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          genres: r.genres || [],
          communityRating: r.community_rating,
        })),
        stats: {
          totalMovies: movieResults.rows.length,
          totalSeries: seriesResults.rows.length,
        },
      }

      return reply.send(response)
    }
  )
}

export default discoverRoutes
