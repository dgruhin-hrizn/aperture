/**
 * GET /api/movies/:id/trailer — best YouTube trailer URL from TMDb videos API
 */
import type { FastifyInstance } from 'fastify'
import { getMovieVideos, type TMDbVideo } from '@aperture/core'
import { queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'

function pickBestTrailer(
  videos: TMDbVideo[]
): { trailerUrl: string; name: string; site: string } | null {
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key)
  const officialTrailer = youtube.find((v) => v.type === 'Trailer' && v.official)
  const anyTrailer = youtube.find((v) => v.type === 'Trailer')
  const teaser = youtube.find((v) => v.type === 'Teaser')
  const picked = officialTrailer || anyTrailer || teaser
  if (!picked) return null
  return {
    trailerUrl: `https://www.youtube.com/watch?v=${picked.key}`,
    name: picked.name,
    site: picked.site,
  }
}

export function registerTrailerHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/api/movies/:id/trailer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params

      const row = await queryOne<{ tmdb_id: string | null }>(
        `SELECT tmdb_id FROM movies WHERE id = $1`,
        [id]
      )
      if (!row) {
        return reply.status(404).send({ error: 'Movie not found' })
      }
      const tmdbId = row.tmdb_id ? parseInt(row.tmdb_id, 10) : NaN
      if (!Number.isFinite(tmdbId)) {
        return reply.status(422).send({ error: 'Movie has no TMDb ID', trailerUrl: null })
      }

      const data = await getMovieVideos(tmdbId)
      const results = data?.results ?? []
      const picked = pickBestTrailer(results)
      if (!picked) {
        return reply.send({ trailerUrl: null, name: null, site: null })
      }
      return reply.send(picked)
    }
  )
}
