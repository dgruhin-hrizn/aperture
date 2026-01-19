/**
 * Discovery Routes (Missing Content Suggestions)
 * 
 * API routes for suggesting content not in the user's library
 */

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin, type SessionUser } from '../../plugins/auth.js'
import { queryOne, query } from '../../lib/db.js'
import {
  getDiscoveryCandidates,
  getDiscoveryCandidateCount,
  getLatestDiscoveryRun,
  regenerateUserDiscovery,
  isJellyseerrConfigured,
  fetchFilteredCandidates,
  scoreCandidates,
  filterCandidates,
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryFilterOptions,
  type DynamicFetchFilters,
  type MediaType,
} from '@aperture/core'
import {
  discoverySchemas,
  getDiscoveryMoviesSchema,
  getDiscoverySeriesSchema,
  refreshDiscoverySchema,
  expandDiscoverySchema,
  getDiscoveryStatusSchema,
  getDiscoveryPrerequisitesSchema,
} from './schemas.js'

// Helper to parse filter query params
function parseFilterParams(queryParams: {
  limit?: string
  offset?: string
  languages?: string
  includeUnknownLanguage?: string
  genres?: string
  yearStart?: string
  yearEnd?: string
  minSimilarity?: string
}): DiscoveryFilterOptions {
  const options: DiscoveryFilterOptions = {
    limit: Math.min(parseInt(queryParams.limit || '50', 10), 100),
    offset: parseInt(queryParams.offset || '0', 10),
  }

  // Languages: comma-separated ISO 639-1 codes (e.g., "en,ko,ja")
  if (queryParams.languages) {
    options.languages = queryParams.languages.split(',').map(l => l.trim()).filter(Boolean)
  }

  // Include content with unknown language (default: true)
  // Only set to false if explicitly passed as 'false' or '0'
  if (queryParams.includeUnknownLanguage !== undefined) {
    options.includeUnknownLanguage = queryParams.includeUnknownLanguage !== 'false' && queryParams.includeUnknownLanguage !== '0'
  }

  // Genres: comma-separated genre IDs (e.g., "28,12,878")
  if (queryParams.genres) {
    options.genreIds = queryParams.genres.split(',').map(g => parseInt(g.trim(), 10)).filter(id => !isNaN(id))
  }

  // Year range
  if (queryParams.yearStart) {
    const year = parseInt(queryParams.yearStart, 10)
    if (!isNaN(year)) options.yearStart = year
  }
  if (queryParams.yearEnd) {
    const year = parseInt(queryParams.yearEnd, 10)
    if (!isNaN(year)) options.yearEnd = year
  }

  // Minimum similarity threshold (0-1)
  if (queryParams.minSimilarity) {
    const sim = parseFloat(queryParams.minSimilarity)
    if (!isNaN(sim) && sim >= 0 && sim <= 1) options.minSimilarity = sim
  }

  return options
}

const discoveryRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(discoverySchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/discovery/movies
   * Get discovery suggestions for movies not in the library
   */
  fastify.get<{
    Querystring: {
      limit?: string
      offset?: string
      languages?: string
      includeUnknownLanguage?: string
      genres?: string
      yearStart?: string
      yearEnd?: string
      minSimilarity?: string
    }
  }>(
    '/api/discovery/movies',
    { preHandler: requireAuth, schema: getDiscoveryMoviesSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const filterOptions = parseFilterParams(request.query)

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
          message: 'Contact your admin to enable discovery suggestions',
        })
      }

      // Get latest run
      const run = await getLatestDiscoveryRun(currentUser.id, 'movie')

      // Get candidates with filters
      const candidates = await getDiscoveryCandidates(currentUser.id, 'movie', filterOptions)
      const total = await getDiscoveryCandidateCount(currentUser.id, 'movie', filterOptions)

      return reply.send({
        run,
        candidates,
        pagination: {
          total,
          limit: filterOptions.limit!,
          offset: filterOptions.offset!,
          hasMore: filterOptions.offset! + candidates.length < total,
        },
      })
    }
  )

  /**
   * GET /api/discovery/series
   * Get discovery suggestions for series not in the library
   */
  fastify.get<{
    Querystring: {
      limit?: string
      offset?: string
      languages?: string
      includeUnknownLanguage?: string
      genres?: string
      yearStart?: string
      yearEnd?: string
      minSimilarity?: string
    }
  }>(
    '/api/discovery/series',
    { preHandler: requireAuth, schema: getDiscoverySeriesSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const filterOptions = parseFilterParams(request.query)

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
          message: 'Contact your admin to enable discovery suggestions',
        })
      }

      // Get latest run
      const run = await getLatestDiscoveryRun(currentUser.id, 'series')

      // Get candidates with filters
      const candidates = await getDiscoveryCandidates(currentUser.id, 'series', filterOptions)
      const total = await getDiscoveryCandidateCount(currentUser.id, 'series', filterOptions)

      return reply.send({
        run,
        candidates,
        pagination: {
          total,
          limit: filterOptions.limit!,
          offset: filterOptions.offset!,
          hasMore: filterOptions.offset! + candidates.length < total,
        },
      })
    }
  )

  /**
   * POST /api/discovery/refresh/movies
   * Trigger regeneration of movie discovery suggestions
   */
  fastify.post(
    '/api/discovery/refresh/movies',
    { preHandler: requireAuth, schema: refreshDiscoverySchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
        })
      }

      try {
        const result = await regenerateUserDiscovery(currentUser.id, 'movie')
        return reply.send({
          message: 'Movie discovery suggestions regenerated',
          runId: result.runId,
          candidatesStored: result.candidatesStored,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId: currentUser.id }, 'Failed to regenerate movie discovery')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )

  /**
   * POST /api/discovery/refresh/series
   * Trigger regeneration of series discovery suggestions
   */
  fastify.post(
    '/api/discovery/refresh/series',
    { preHandler: requireAuth, schema: refreshDiscoverySchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
        })
      }

      try {
        const result = await regenerateUserDiscovery(currentUser.id, 'series')
        return reply.send({
          message: 'Series discovery suggestions regenerated',
          runId: result.runId,
          candidatesStored: result.candidatesStored,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId: currentUser.id }, 'Failed to regenerate series discovery')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )

  /**
   * POST /api/discovery/:mediaType/expand
   * Dynamically fetch additional candidates when filters reduce results below target
   */
  fastify.post<{
    Params: { mediaType: string }
    Body: {
      languages?: string[]
      genreIds?: number[]
      yearStart?: number
      yearEnd?: number
      excludeTmdbIds?: number[]
      targetCount?: number
    }
  }>(
    '/api/discovery/:mediaType/expand',
    { preHandler: requireAuth, schema: expandDiscoverySchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType } = request.params
      const { languages, genreIds, yearStart, yearEnd, excludeTmdbIds, targetCount } = request.body

      // Validate media type
      if (mediaType !== 'movies' && mediaType !== 'series') {
        return reply.status(400).send({ error: 'Invalid media type' })
      }

      // Convert route mediaType to core MediaType
      const coreMediaType: MediaType = mediaType === 'movies' ? 'movie' : 'series'

      // Check if user has discovery enabled
      const userSettings = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!userSettings?.discover_enabled) {
        return reply.status(403).send({ error: 'Discovery not enabled for your account' })
      }

      try {
        // Build filter options for dynamic fetching
        const filters: DynamicFetchFilters = {
          languages,
          genreIds,
          yearStart,
          yearEnd,
          excludeTmdbIds: excludeTmdbIds || [],
          limit: targetCount || DEFAULT_DISCOVERY_CONFIG.targetDisplayCount,
        }

        // Fetch filtered candidates from TMDb
        const rawCandidates = await fetchFilteredCandidates(coreMediaType, filters)

        if (rawCandidates.length === 0) {
          return reply.send({
            candidates: [],
            message: 'No additional candidates found matching filters',
          })
        }

        // Filter out library and watched content
        const filteredCandidates = await filterCandidates(currentUser.id, coreMediaType, rawCandidates)

        if (filteredCandidates.length === 0) {
          return reply.send({
            candidates: [],
            message: 'All found candidates are already in library or watched',
          })
        }

        // Score the candidates (quick scoring without embeddings)
        const scoredCandidates = await scoreCandidates(
          currentUser.id,
          coreMediaType,
          filteredCandidates,
          DEFAULT_DISCOVERY_CONFIG
        )

        // Return the scored candidates (frontend will merge with existing)
        return reply.send({
          candidates: scoredCandidates.map((c, index) => ({
            id: `dynamic-${c.tmdbId}`,
            runId: null,
            userId: currentUser.id,
            mediaType: coreMediaType,
            tmdbId: c.tmdbId,
            imdbId: c.imdbId,
            rank: index + 1,
            finalScore: c.finalScore,
            similarityScore: c.similarityScore,
            popularityScore: c.popularityScore,
            recencyScore: c.recencyScore,
            sourceScore: c.sourceScore,
            source: c.source,
            sourceMediaId: c.sourceMediaId ?? null,
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
            scoreBreakdown: c.scoreBreakdown,
            castMembers: c.castMembers || [],
            directors: c.directors || [],
            runtimeMinutes: c.runtimeMinutes ?? null,
            tagline: c.tagline ?? null,
            isEnriched: false,
            isDynamic: true, // Flag to indicate dynamically fetched
            createdAt: new Date(),
          })),
          count: scoredCandidates.length,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId: currentUser.id, mediaType }, 'Failed to expand discovery')
        return reply.status(500).send({ error: `Failed to expand: ${error}` })
      }
    }
  )

  /**
   * GET /api/discovery/status
   * Get discovery status for the current user
   */
  fastify.get(
    '/api/discovery/status',
    { preHandler: requireAuth, schema: getDiscoveryStatusSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Get user's discovery settings
      const userSettings = await queryOne<{
        discover_enabled: boolean
        discover_request_enabled: boolean
      }>(
        `SELECT discover_enabled, discover_request_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!userSettings?.discover_enabled) {
        return reply.send({
          enabled: false,
          requestEnabled: false,
          movieRun: null,
          seriesRun: null,
          movieCount: 0,
          seriesCount: 0,
        })
      }

      // Get latest runs
      const [movieRun, seriesRun, movieCount, seriesCount] = await Promise.all([
        getLatestDiscoveryRun(currentUser.id, 'movie'),
        getLatestDiscoveryRun(currentUser.id, 'series'),
        getDiscoveryCandidateCount(currentUser.id, 'movie'),
        getDiscoveryCandidateCount(currentUser.id, 'series'),
      ])

      return reply.send({
        enabled: true,
        requestEnabled: userSettings.discover_request_enabled,
        movieRun,
        seriesRun,
        movieCount,
        seriesCount,
      })
    }
  )

  /**
   * GET /api/discovery/prerequisites
   * Check if discovery feature prerequisites are met (admin only)
   */
  fastify.get(
    '/api/discovery/prerequisites',
    { preHandler: requireAdmin, schema: getDiscoveryPrerequisitesSchema },
    async (_request, reply) => {
      // Check Jellyseerr configuration
      const jellyseerrConfigured = await isJellyseerrConfigured()

      // Check how many users have discovery enabled
      const usersResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE discover_enabled = true`
      )
      const enabledUserCount = parseInt(usersResult.rows[0]?.count || '0', 10)

      // Get list of enabled users for display
      const enabledUsers = await query<{ username: string }>(
        `SELECT username FROM users WHERE discover_enabled = true ORDER BY username LIMIT 10`
      )

      const ready = jellyseerrConfigured && enabledUserCount > 0

      return reply.send({
        ready,
        jellyseerrConfigured,
        enabledUserCount,
        enabledUsernames: enabledUsers.rows.map(u => u.username),
        message: !ready
          ? !jellyseerrConfigured
            ? 'Jellyseerr integration is not configured. Configure it in Settings → Integrations.'
            : 'No users have discovery enabled. Enable discovery for users in Admin → Users.'
          : null,
      })
    }
  )
}

export default discoveryRoutes
