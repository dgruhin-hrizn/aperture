/**
 * GET /api/discover/tmdb/movie/:tmdbId
 * GET /api/discover/tmdb/tv/:tmdbId
 *
 * TMDb metadata for in-app detail modals (e.g. person credits not in library).
 */
import type { FastifyInstance } from 'fastify'
import {
  getMovieCredits,
  getMovieDetails,
  getMovieVideos,
  getTVCredits,
  getTVDetails,
  getTVExternalIds,
  getTVVideos,
  pickBestYoutubeTrailer,
  type TMDbCastMember,
  type TMDbMovieCreditsResponse,
  type TMDbMovieDetails,
  type TMDbTVCreditsResponse,
  type TMDbTVDetails,
} from '@aperture/core'
import { requireAuth } from '../../plugins/auth.js'

export interface TmdbExternalCastMember {
  id: number
  name: string
  character: string
  profilePath: string | null
}

export interface TmdbExternalDetailPayload {
  mediaType: 'movie' | 'series'
  tmdbId: number
  imdbId: string | null
  title: string
  originalTitle: string | null
  tagline: string | null
  overview: string | null
  posterPath: string | null
  backdropPath: string | null
  releaseYear: number | null
  runtimeMinutes: number | null
  voteAverage: number | null
  voteCount: number | null
  genres: { id: number; name: string }[]
  directors: string[]
  creators: string[]
  castMembers: TmdbExternalCastMember[]
  numberOfSeasons: number | null
  numberOfEpisodes: number | null
  status: string | null
}

function mapCastMembers(cast: TMDbCastMember[]): TmdbExternalCastMember[] {
  return cast.slice(0, 14).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: c.profile_path,
  }))
}

function mapMovieExternalDetail(
  details: TMDbMovieDetails,
  credits: TMDbMovieCreditsResponse | null
): TmdbExternalDetailPayload {
  const releaseYear = details.release_date
    ? parseInt(details.release_date.slice(0, 4), 10)
    : null
  const directors = credits
    ? [
        ...new Set(
          credits.crew.filter((c) => c.job === 'Director').map((c) => c.name)
        ),
      ]
    : []

  return {
    mediaType: 'movie',
    tmdbId: details.id,
    imdbId: details.imdb_id,
    title: details.title,
    originalTitle:
      details.original_title && details.original_title !== details.title
        ? details.original_title
        : null,
    tagline: details.tagline,
    overview: details.overview,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
    runtimeMinutes: details.runtime,
    voteAverage: details.vote_average,
    voteCount: details.vote_count,
    genres: details.genres.map((g) => ({ id: g.id, name: g.name })),
    directors,
    creators: [],
    castMembers: mapCastMembers(credits?.cast ?? []),
    numberOfSeasons: null,
    numberOfEpisodes: null,
    status: null,
  }
}

function mapTvExternalDetail(
  details: TMDbTVDetails,
  credits: TMDbTVCreditsResponse | null,
  imdbId: string | null
): TmdbExternalDetailPayload {
  const releaseYear = details.first_air_date
    ? parseInt(details.first_air_date.slice(0, 4), 10)
    : null
  const episodeRun = details.episode_run_time
  const runtimeMinutes =
    episodeRun && episodeRun.length > 0
      ? Math.round(episodeRun.reduce((a, b) => a + b, 0) / episodeRun.length)
      : null

  return {
    mediaType: 'series',
    tmdbId: details.id,
    imdbId,
    title: details.name,
    originalTitle:
      details.original_name && details.original_name !== details.name
        ? details.original_name
        : null,
    tagline: details.tagline,
    overview: details.overview,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
    runtimeMinutes,
    voteAverage: details.vote_average,
    voteCount: details.vote_count,
    genres: details.genres.map((g) => ({ id: g.id, name: g.name })),
    directors: [],
    creators: details.created_by.map((c) => c.name),
    castMembers: mapCastMembers(credits?.cast ?? []),
    numberOfSeasons: details.number_of_seasons,
    numberOfEpisodes: details.number_of_episodes,
    status: details.status,
  }
}

export function registerTmdbExternalDetailRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { tmdbId: string } }>(
    '/api/discover/tmdb/movie/:tmdbId/trailer',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const tmdbId = parseInt(request.params.tmdbId, 10)
      if (!Number.isFinite(tmdbId)) {
        return reply.status(400).send({ error: 'Invalid tmdbId' })
      }
      const data = await getMovieVideos(tmdbId)
      const picked = pickBestYoutubeTrailer(data?.results ?? [])
      if (!picked) {
        return reply.send({ trailerUrl: null, name: null, site: null })
      }
      return reply.send(picked)
    }
  )

  fastify.get<{ Params: { tmdbId: string } }>(
    '/api/discover/tmdb/tv/:tmdbId/trailer',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const tmdbId = parseInt(request.params.tmdbId, 10)
      if (!Number.isFinite(tmdbId)) {
        return reply.status(400).send({ error: 'Invalid tmdbId' })
      }
      const data = await getTVVideos(tmdbId)
      const picked = pickBestYoutubeTrailer(data?.results ?? [])
      if (!picked) {
        return reply.send({ trailerUrl: null, name: null, site: null })
      }
      return reply.send(picked)
    }
  )

  fastify.get<{ Params: { tmdbId: string } }>(
    '/api/discover/tmdb/movie/:tmdbId',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const tmdbId = parseInt(request.params.tmdbId, 10)
      if (!Number.isFinite(tmdbId)) {
        return reply.status(400).send({ error: 'Invalid tmdbId' })
      }
      const [details, credits] = await Promise.all([
        getMovieDetails(tmdbId),
        getMovieCredits(tmdbId),
      ])
      if (!details) {
        return reply.status(404).send({ error: 'Movie not found' })
      }
      return reply.send(mapMovieExternalDetail(details, credits))
    }
  )

  fastify.get<{ Params: { tmdbId: string } }>(
    '/api/discover/tmdb/tv/:tmdbId',
    { preHandler: requireAuth, schema: { tags: ['discovery'] } },
    async (request, reply) => {
      const tmdbId = parseInt(request.params.tmdbId, 10)
      if (!Number.isFinite(tmdbId)) {
        return reply.status(400).send({ error: 'Invalid tmdbId' })
      }
      const [details, credits, external] = await Promise.all([
        getTVDetails(tmdbId),
        getTVCredits(tmdbId),
        getTVExternalIds(tmdbId),
      ])
      if (!details) {
        return reply.status(404).send({ error: 'TV show not found' })
      }
      const imdbId = external?.imdb_id ?? null
      return reply.send(mapTvExternalDetail(details, credits, imdbId))
    }
  )
}
