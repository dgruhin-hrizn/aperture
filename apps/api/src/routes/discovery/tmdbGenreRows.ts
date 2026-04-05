/**
 * TMDb Discover genre strips on Discovery (movies / TV tabs).
 */
import type { FastifyInstance } from 'fastify'
import { requireAuth, type SessionUser } from '../../plugins/auth.js'
import { queryOne } from '../../lib/db.js'
import {
  fetchGenreStripDiscoverCandidates,
  batchGetSeerrMediaStatus,
  getGenreStripMovieRows,
  getGenreStripSeriesRows,
  GENRE_STRIP_DEFAULT_ROW_LIMIT,
  GENRE_STRIP_MAX_EXCLUDE_GENRES_PER_ROW,
  GENRE_STRIP_MAX_ROW_LIMIT,
  sanitizeGenreStripOriginCountry,
  sanitizeGenreStripYear,
  type MediaType,
  type RawCandidate,
} from '@aperture/core'

const PLACEHOLDER_RUN = '00000000-0000-0000-0000-000000000000'

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw || String(fallback), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, GENRE_STRIP_MAX_ROW_LIMIT)
}

function parseGenreIdsQuery(genreIds: string | undefined, genreId: string | undefined): number[] | null {
  if (genreIds !== undefined && genreIds.trim() !== '') {
    const parts = genreIds.split(',').map((s) => parseInt(s.trim(), 10))
    if (parts.some((n) => !Number.isFinite(n) || n < 1)) return null
    const uniq = [...new Set(parts.map((n) => Math.floor(n)))]
    return uniq.length > 0 ? uniq : null
  }
  const single = parseInt(genreId || '', 10)
  if (Number.isFinite(single) && single >= 1) return [Math.floor(single)]
  return null
}

/** Comma-separated TMDb genre IDs for `without_genres`; empty string → []. */
function parseExcludeGenreIdsQuery(raw: string | undefined): number[] | null {
  if (raw === undefined || raw.trim() === '') return []
  const parts = raw.split(',').map((s) => parseInt(s.trim(), 10))
  if (parts.some((n) => !Number.isFinite(n) || n < 1)) return null
  const uniq = [...new Set(parts.map((n) => Math.floor(n)))]
  if (uniq.length > GENRE_STRIP_MAX_EXCLUDE_GENRES_PER_ROW) return null
  return uniq
}

/** Present and non-empty but invalid year → bad. Omitted or empty → ok (undefined). */
function parseYearQueryParam(raw: string | undefined): { value?: number; bad: boolean } {
  if (raw === undefined || raw.trim() === '') return { bad: false }
  const y = sanitizeGenreStripYear(raw)
  if (y === undefined) return { bad: true }
  return { value: y, bad: false }
}

/** yearEnd: numeric year, or `today` / `current` (rolling calendar year). */
function parseYearEndQueryParam(raw: string | undefined): {
  value?: number
  current?: boolean
  bad: boolean
} {
  if (raw === undefined || raw.trim() === '') return { bad: false }
  const s = raw.trim().toLowerCase()
  if (s === 'today' || s === 'current') return { current: true, bad: false }
  const y = sanitizeGenreStripYear(raw)
  if (y === undefined) return { bad: true }
  return { value: y, bad: false }
}

function rawToCandidateJson(
  c: RawCandidate,
  rank: number,
  userId: string,
  mediaType: MediaType
): Record<string, unknown> {
  return {
    id: `tmdb-genre-${c.tmdbId}`,
    runId: PLACEHOLDER_RUN,
    userId,
    mediaType,
    tmdbId: c.tmdbId,
    imdbId: c.imdbId,
    rank,
    finalScore: 0,
    similarityScore: null,
    popularityScore: null,
    recencyScore: null,
    sourceScore: null,
    source: 'tmdb_genre_row',
    sourceMediaId: null,
    title: c.title,
    originalTitle: c.originalTitle,
    originalLanguage: c.originalLanguage,
    releaseYear: c.releaseYear,
    posterPath: c.posterPath,
    backdropPath: c.backdropPath,
    overview: c.overview,
    genres: c.genres,
    voteAverage: c.voteAverage,
    voteCount: c.voteCount,
    scoreBreakdown: {},
    castMembers: c.castMembers ?? [],
    directors: c.directors ?? [],
    runtimeMinutes: c.runtimeMinutes ?? null,
    tagline: c.tagline ?? null,
    isEnriched: false,
    isDynamic: true,
    createdAt: new Date().toISOString(),
  }
}

export function registerTmdbGenreRowsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/discovery/tmdb-genre-rows/config', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const user = await queryOne<{ discover_enabled: boolean }>(
      `SELECT discover_enabled FROM users WHERE id = $1`,
      [currentUser.id]
    )
    if (!user?.discover_enabled) {
      return reply.status(403).send({ error: 'Discovery not enabled for your account' })
    }
    const [movieGenreRows, seriesGenreRows] = await Promise.all([
      getGenreStripMovieRows(),
      getGenreStripSeriesRows(),
    ])
    return reply.send({ movieGenreRows, seriesGenreRows })
  })

  fastify.get<{
    Querystring: {
      mediaType?: string
      genreId?: string
      genreIds?: string
      limit?: string
      withOriginCountry?: string
      excludeGenreIds?: string
      yearStart?: string
      yearEnd?: string
    }
  }>('/api/discovery/tmdb-genre-row', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const user = await queryOne<{ discover_enabled: boolean }>(
      `SELECT discover_enabled FROM users WHERE id = $1`,
      [currentUser.id]
    )
    if (!user?.discover_enabled) {
      return reply.status(403).send({ error: 'Discovery not enabled for your account' })
    }

    const mt = (request.query.mediaType || '').toLowerCase()
    if (mt !== 'movie' && mt !== 'series') {
      return reply.status(400).send({ error: 'mediaType must be movie or series' })
    }
    const coreMediaType: MediaType = mt === 'movie' ? 'movie' : 'series'

    const genreIdList = parseGenreIdsQuery(request.query.genreIds, request.query.genreId)
    if (!genreIdList) {
      return reply.status(400).send({
        error: 'genreIds (comma-separated) or genreId is required; all must be positive integers',
      })
    }

    const limit = parseLimit(request.query.limit, GENRE_STRIP_DEFAULT_ROW_LIMIT)

    const withOriginCountry = sanitizeGenreStripOriginCountry(request.query.withOriginCountry)

    const excludeList = parseExcludeGenreIdsQuery(request.query.excludeGenreIds)
    if (excludeList === null) {
      return reply.status(400).send({
        error: `excludeGenreIds must be comma-separated positive integers (max ${GENRE_STRIP_MAX_EXCLUDE_GENRES_PER_ROW} ids)`,
      })
    }
    const genreSet = new Set(genreIdList)
    for (const id of excludeList) {
      if (genreSet.has(id)) {
        return reply.status(400).send({ error: 'excludeGenreIds must not overlap genreIds' })
      }
    }

    const ys = parseYearQueryParam(request.query.yearStart)
    const ye = parseYearEndQueryParam(request.query.yearEnd)
    if (ys.bad || ye.bad) {
      return reply.status(400).send({
        error:
          'yearStart must be an integer between 1900 and 2100 when set; yearEnd must be a year in that range, or "today" / "current" for the current calendar year',
      })
    }
    const nowYear = new Date().getFullYear()
    if (ys.value !== undefined && ye.current && ys.value > nowYear) {
      return reply.status(400).send({
        error: 'yearStart must be less than or equal to the current year when yearEnd is today',
      })
    }
    if (ys.value !== undefined && ye.value !== undefined && ys.value > ye.value) {
      return reply.status(400).send({ error: 'yearStart must be less than or equal to yearEnd' })
    }

    const sliced = await fetchGenreStripDiscoverCandidates(coreMediaType, {
      genreIds: genreIdList,
      withoutGenreIds: excludeList.length > 0 ? excludeList : undefined,
      withOriginCountry,
      targetCount: limit,
      userId: currentUser.id,
      yearStart: ys.value,
      yearEnd: ye.current ? undefined : ye.value,
      yearEndCurrent: ye.current === true ? true : undefined,
    })

    const items = sliced.map((c) => ({
      tmdbId: c.tmdbId,
      mediaType: coreMediaType === 'movie' ? ('movie' as const) : ('tv' as const),
    }))
    const seerrMap = items.length > 0 ? await batchGetSeerrMediaStatus(items) : new Map()
    const seerrStatuses: Record<
      number,
      { exists: boolean; status: string; requested: boolean; requestStatus?: string }
    > = {}
    for (const [tmdbId, st] of seerrMap) {
      seerrStatuses[tmdbId] = {
        exists: st.exists,
        status: st.status,
        requested: st.requested,
      }
    }

    const candidates = sliced.map((c, i) => rawToCandidateJson(c, i + 1, currentUser.id, coreMediaType))

    return reply.send({ candidates, seerrStatuses })
  })
}
