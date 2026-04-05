/**
 * JustWatch-backed streaming charts for Discovery (popular, search, providers).
 */
import type { FastifyInstance } from 'fastify'
import { requireAuth, type SessionUser } from '../../plugins/auth.js'
import { queryOne } from '../../lib/db.js'
import {
  attachLibraryMatch,
  attachTmdbPosterPaths,
  batchGetSeerrMediaStatus,
  buildCacheKey,
  fetchPopularTitles,
  fetchProviders,
  fetchSearchTitles,
  loadCachedOrFetch,
  getStreamingDiscoveryEnabled,
  getStreamingDiscoveryProviderStrips,
  isSeerrConfigured,
  parsePopularEdges,
  parseProvidersResponse,
  sortStreamingRowsForDiscovery,
  type JustWatchStreamingRow,
} from '@aperture/core'

function parsePackagesParam(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseLimit(raw: string | undefined, fallback: number, max = 100): number {
  const n = parseInt(raw || String(fallback), 10)
  if (Number.isNaN(n) || n < 1) return fallback
  return Math.min(n, max)
}

function parseOffset(raw: string | undefined): number {
  const n = parseInt(raw || '0', 10)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

async function assertStreamingDiscoveryAllowed(
  userId: string
): Promise<{ ok: true } | { ok: false; statusCode: number; body: Record<string, unknown> }> {
  const [user, streamingOn] = await Promise.all([
    queryOne<{ discover_enabled: boolean }>(`SELECT discover_enabled FROM users WHERE id = $1`, [userId]),
    getStreamingDiscoveryEnabled(),
  ])
  if (!user?.discover_enabled) {
    return {
      ok: false,
      statusCode: 403,
      body: { error: 'Discovery not enabled for your account' },
    }
  }
  if (!streamingOn) {
    return {
      ok: false,
      statusCode: 403,
      body: { error: 'Streaming discovery is disabled' },
    }
  }
  return { ok: true }
}

function rowToSeerrItem(row: JustWatchStreamingRow): { tmdbId: number; mediaType: 'movie' | 'tv' } | null {
  if (!row.tmdbId) return null
  if (row.objectType === 'MOVIE') return { tmdbId: row.tmdbId, mediaType: 'movie' }
  if (row.objectType === 'SHOW') return { tmdbId: row.tmdbId, mediaType: 'tv' }
  return null
}

async function attachSeerrStatuses(
  rows: JustWatchStreamingRow[]
): Promise<Record<number, { exists: boolean; status: string; requested: boolean }>> {
  const seerrOk = await isSeerrConfigured()
  if (!seerrOk || rows.length === 0) return {}

  const items: { tmdbId: number; mediaType: 'movie' | 'tv' }[] = []
  for (const r of rows) {
    const it = rowToSeerrItem(r)
    if (it) items.push(it)
    if (items.length >= 80) break
  }
  if (items.length === 0) return {}

  const map = await batchGetSeerrMediaStatus(items)
  const out: Record<number, { exists: boolean; status: string; requested: boolean }> = {}
  for (const [tmdbId, st] of map) {
    out[tmdbId] = st
  }
  return out
}

export function registerStreamingDiscoveryRoutes(fastify: FastifyInstance) {
  fastify.get('/api/discovery/streaming/config', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await assertStreamingDiscoveryAllowed(currentUser.id)
    if (!gate.ok) {
      return reply.status(gate.statusCode).send(gate.body)
    }
    const providerStrips = await getStreamingDiscoveryProviderStrips()
    return reply.send({ providerStrips })
  })

  fastify.get<{
    Querystring: {
      country?: string
      language?: string
      provider?: string
      limit?: string
      offset?: string
      missingOnly?: string
    }
  }>('/api/discovery/streaming/popular', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await assertStreamingDiscoveryAllowed(currentUser.id)
    if (!gate.ok) {
      return reply.status(gate.statusCode).send(gate.body)
    }

    const country = (request.query.country || 'US').toUpperCase()
    const language = request.query.language || 'en'
    const packages = parsePackagesParam(request.query.provider)
    const first = parseLimit(request.query.limit, 30)
    const offset = parseOffset(request.query.offset)
    const missingOnly = request.query.missingOnly === 'true' || request.query.missingOnly === '1'

    const cacheKey = buildCacheKey({
      op: 'popular',
      country,
      language,
      provider: packages?.join(',') ?? '',
      first,
      offset,
    })

    try {
      const { raw, stale } = await loadCachedOrFetch(cacheKey, () =>
        fetchPopularTitles({
          country,
          language,
          first,
          offset,
          packages,
          bestOnly: true,
        })
      )
      let rows = parsePopularEdges(raw)
      rows = await attachLibraryMatch(rows)
      rows = await attachTmdbPosterPaths(rows, { language })
      rows = sortStreamingRowsForDiscovery(rows)
      if (missingOnly) {
        rows = rows.filter((r: JustWatchStreamingRow) => !r.inLibrary && r.tmdbId != null)
      }
      const seerrStatuses = await attachSeerrStatuses(rows)
      return reply.send({ rows, stale, seerrStatuses })
    } catch (e) {
      if (e instanceof Error && e.message === 'JUSTWATCH_UNAVAILABLE') {
        fastify.log.warn({ country }, 'JustWatch popular fetch failed with no cache')
        return reply.status(502).send({ error: 'Streaming data temporarily unavailable', rows: [], stale: false, seerrStatuses: {} })
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      fastify.log.error({ err: e }, 'JustWatch popular error')
      return reply.status(500).send({ error: msg })
    }
  })

  fastify.get<{
    Querystring: {
      q?: string
      country?: string
      language?: string
      provider?: string
      limit?: string
      offset?: string
      missingOnly?: string
    }
  }>('/api/discovery/streaming/search', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await assertStreamingDiscoveryAllowed(currentUser.id)
    if (!gate.ok) {
      return reply.status(gate.statusCode).send(gate.body)
    }

    const q = (request.query.q || '').trim()
    if (!q) {
      return reply.status(400).send({ error: 'Query parameter q is required' })
    }

    const country = (request.query.country || 'US').toUpperCase()
    const language = request.query.language || 'en'
    const packages = parsePackagesParam(request.query.provider)
    const first = parseLimit(request.query.limit, 30)
    const offset = parseOffset(request.query.offset)
    const missingOnly = request.query.missingOnly === 'true' || request.query.missingOnly === '1'

    const cacheKey = buildCacheKey({
      op: 'search',
      country,
      language,
      q,
      provider: packages?.join(',') ?? '',
      first,
      offset,
    })

    try {
      const { raw, stale } = await loadCachedOrFetch(cacheKey, () =>
        fetchSearchTitles({
          country,
          language,
          query: q,
          first,
          offset,
          packages,
          bestOnly: true,
        })
      )
      let rows = parsePopularEdges(raw)
      rows = await attachLibraryMatch(rows)
      rows = await attachTmdbPosterPaths(rows, { language })
      rows = sortStreamingRowsForDiscovery(rows)
      if (missingOnly) {
        rows = rows.filter((r: JustWatchStreamingRow) => !r.inLibrary && r.tmdbId != null)
      }
      const seerrStatuses = await attachSeerrStatuses(rows)
      return reply.send({ rows, stale, seerrStatuses })
    } catch (e) {
      if (e instanceof Error && e.message === 'JUSTWATCH_UNAVAILABLE') {
        return reply.status(502).send({ error: 'Streaming data temporarily unavailable', rows: [], stale: false, seerrStatuses: {} })
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      fastify.log.error({ err: e }, 'JustWatch search error')
      return reply.status(500).send({ error: msg })
    }
  })

  fastify.get<{
    Querystring: { country?: string }
  }>('/api/discovery/streaming/providers', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await assertStreamingDiscoveryAllowed(currentUser.id)
    if (!gate.ok) {
      return reply.status(gate.statusCode).send(gate.body)
    }

    const country = (request.query.country || 'US').toUpperCase()
    const cacheKey = buildCacheKey({ op: 'providers', country })

    try {
      const { raw, stale } = await loadCachedOrFetch(cacheKey, () => fetchProviders({ country }))
      const providers = parseProvidersResponse(raw)
      return reply.send({ providers, stale })
    } catch (e) {
      if (e instanceof Error && e.message === 'JUSTWATCH_UNAVAILABLE') {
        return reply.status(502).send({ error: 'Streaming data temporarily unavailable', providers: [], stale: false })
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      fastify.log.error({ err: e }, 'JustWatch providers error')
      return reply.status(500).send({ error: msg })
    }
  })
}
