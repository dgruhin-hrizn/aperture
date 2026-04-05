/**
 * Admin-only Gap Analysis API
 */

import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import {
  getLatestCompletedGapRun,
  getActiveRunningGapRun,
  getGapCollectionSummaries,
  getGapCollectionParts,
  listGapResults,
  getSystemSetting,
  isSeerrConfigured,
  createSeerrRequest,
  createDiscoveryRequest,
  updateDiscoveryRequestStatus,
  hasExistingRequest,
  resolveSeerrUserIdForProfile,
  getJobProgress,
} from '@aperture/core'
import { requireAdmin, type SessionUser } from '../../plugins/auth.js'
import { query, queryOne } from '../../lib/db.js'
import { runJob } from '../jobs/executor.js'
import { activeJobs } from '../jobs/state.js'

const BLOCKING_STATUSES = new Set(['pending', 'submitted', 'approved'])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureSeerrUserIdForRequest(userId: string): Promise<number | null> {
  const row = await queryOne<{
    seerr_user_id: number | null
    email: string | null
    username: string
    display_name: string | null
    provider: 'emby' | 'jellyfin'
    provider_user_id: string
  }>(
    `SELECT seerr_user_id, email, username, display_name, provider, provider_user_id
     FROM users WHERE id = $1`,
    [userId]
  )
  if (!row) return null
  if (row.seerr_user_id != null) return row.seerr_user_id

  const resolved = await resolveSeerrUserIdForProfile({
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    provider: row.provider,
    providerUserId: row.provider_user_id,
  })
  if (resolved != null) {
    await query(`UPDATE users SET seerr_user_id = $1, updated_at = NOW() WHERE id = $2`, [
      resolved,
      userId,
    ])
  }
  return resolved
}

const gapAnalysisRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/admin/gap-analysis/latest
   * Returns the latest run metadata + per-collection summaries (pure SQL, fast).
   */
  fastify.get(
    '/api/admin/gap-analysis/latest',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const tmdbKey = await getSystemSetting('tmdb_api_key')
      const moviesWithCollection = await queryOne<{ c: string }>(
        `SELECT COUNT(*)::text as c FROM movies
         WHERE collection_id IS NOT NULL AND trim(collection_id) != ''`
      )
      const collectionMovieCount = parseInt(moviesWithCollection?.c ?? '0', 10)

      const activeRun = await getActiveRunningGapRun()
      const latest = await getLatestCompletedGapRun()

      let collectionSummaries: Awaited<ReturnType<typeof getGapCollectionSummaries>> = []
      if (!activeRun && latest) {
        collectionSummaries = await getGapCollectionSummaries(latest.id)
      }

      return reply.send({
        prerequisites: {
          tmdbConfigured: !!(tmdbKey && tmdbKey.trim() !== ''),
          moviesWithCollectionCount: collectionMovieCount,
        },
        run: latest,
        activeRun,
        collectionSummaries,
      })
    }
  )

  /**
   * GET /api/admin/gap-analysis/results
   * Paginated missing gap results (pure SQL, fast).
   */
  fastify.get<{
    Querystring: {
      runId?: string
      collectionId?: string
      search?: string
      page?: string
      pageSize?: string
      sortBy?: string
      sortDir?: string
    }
  }>('/api/admin/gap-analysis/results', { preHandler: requireAdmin }, async (request, reply) => {
    const user = request.user as SessionUser
    const latest = await getLatestCompletedGapRun()
    const runId = request.query.runId || latest?.id
    if (!runId) {
      return reply.status(404).send({ error: 'No gap analysis run found' })
    }

    const page = request.query.page ? parseInt(request.query.page, 10) : 1
    const pageSize = request.query.pageSize ? parseInt(request.query.pageSize, 10) : 50
    const collectionId =
      request.query.collectionId != null && request.query.collectionId !== ''
        ? parseInt(request.query.collectionId, 10)
        : undefined

    const rawSort = request.query.sortBy
    const sortBy =
      rawSort === 'title' || rawSort === 'release_date' || rawSort === 'collection_name'
        ? rawSort
        : undefined
    const rawDir = request.query.sortDir
    const sortDir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : undefined

    const result = await listGapResults({
      runId,
      userId: user.id,
      collectionId: Number.isFinite(collectionId as number) ? collectionId : undefined,
      search: request.query.search,
      sortBy,
      sortDir,
      page,
      pageSize,
    })

    return reply.send(result)
  })

  /**
   * GET /api/admin/gap-analysis/collection-parts?ids=1,2,3
   * All released parts for given collections with in_library + seerr_status (pure SQL, fast).
   */
  fastify.get(
    '/api/admin/gap-analysis/collection-parts',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const raw = (request.query as { ids?: string }).ids
      if (!raw || !String(raw).trim()) {
        return reply
          .status(400)
          .send({ error: 'Query parameter ids is required (comma-separated TMDb collection ids)' })
      }

      const latest = await getLatestCompletedGapRun()
      if (!latest) {
        return reply.status(404).send({ error: 'No completed gap analysis run' })
      }

      const ids = String(raw)
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))

      const map = await getGapCollectionParts(latest.id, ids)
      const collections: Record<string, { collectionId: number; collectionName: string; collectionPosterPath: string | null; parts: unknown[] }> = {}
      for (const [id, payload] of map) {
        collections[String(id)] = payload
      }
      return reply.send({ collections })
    }
  )

  /**
   * POST /api/admin/gap-analysis/refresh
   */
  fastify.post('/api/admin/gap-analysis/refresh', { preHandler: requireAdmin }, async (_request, reply) => {
    const name = 'refresh-library-gaps'
    const existingJobId = activeJobs.get(name)
    if (existingJobId) {
      const progress = getJobProgress(existingJobId)
      if (progress?.status === 'running') {
        return reply.status(409).send({
          error: 'Gap analysis is already running',
          jobId: existingJobId,
        })
      }
    }

    const jobId = randomUUID()
    activeJobs.set(name, jobId)
    runJob(name, jobId).catch((err) => {
      fastify.log.error({ err, jobId }, 'refresh-library-gaps failed')
    })

    return reply.send({
      message: 'Library gap analysis started',
      jobId,
      jobName: name,
      status: 'running',
    })
  })

  /**
   * POST /api/admin/gap-analysis/request
   */
  fastify.post<{
    Body: {
      items: { tmdbId: number; mediaType: 'movie' | 'series'; title: string }[]
      seerrOptions?: {
        rootFolder?: string
        profileId?: number
        serverId?: number
        is4k?: boolean
        languageProfileId?: number
      }
    }
  }>('/api/admin/gap-analysis/request', { preHandler: requireAdmin }, async (request, reply) => {
    const user = request.user as SessionUser
    const { items, seerrOptions } = request.body || { items: [] }

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'items array required' })
    }
    if (items.length > 200) {
      return reply.status(400).send({ error: 'Maximum 200 items per request' })
    }

    if (!(await isSeerrConfigured())) {
      return reply.status(503).send({ error: 'Seerr is not configured' })
    }

    const requireMapping = (await getSystemSetting('seerr_require_user_mapping')) === 'true'
    const seerrUserId = await ensureSeerrUserIdForRequest(user.id)
    if (requireMapping && seerrUserId == null) {
      return reply.status(422).send({
        error: 'Seerr account not linked',
        message:
          'Your Aperture account could not be matched to a Seerr user. Ask an admin to link Seerr.',
      })
    }

    let submitted = 0
    let skipped = 0
    let failed = 0
    const errors: { tmdbId: number; title: string; message: string }[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item || typeof item.tmdbId !== 'number' || !item.title) {
        failed++
        errors.push({ tmdbId: item?.tmdbId ?? 0, title: item?.title ?? '', message: 'Invalid item' })
        continue
      }
      if (item.mediaType !== 'movie' && item.mediaType !== 'series') {
        failed++
        errors.push({ tmdbId: item.tmdbId, title: item.title, message: 'Invalid mediaType' })
        continue
      }

      const existing = await hasExistingRequest(user.id, item.tmdbId, item.mediaType)
      if (existing && BLOCKING_STATUSES.has(existing.status)) {
        skipped++
        continue
      }

      try {
        const apertureRequestId = await createDiscoveryRequest(
          user.id,
          item.mediaType,
          item.tmdbId,
          item.title,
          undefined,
          'gap_analysis'
        )

        const seerrMediaType = item.mediaType === 'movie' ? 'movie' : 'tv'
        const result = await createSeerrRequest(item.tmdbId, seerrMediaType, {
          ...(seerrUserId != null ? { userId: seerrUserId } : {}),
          ...(seerrOptions?.rootFolder !== undefined ? { rootFolder: seerrOptions.rootFolder } : {}),
          ...(seerrOptions?.profileId !== undefined ? { profileId: seerrOptions.profileId } : {}),
          ...(seerrOptions?.serverId !== undefined ? { serverId: seerrOptions.serverId } : {}),
          ...(seerrOptions?.is4k !== undefined ? { is4k: seerrOptions.is4k } : {}),
          ...(seerrOptions?.languageProfileId !== undefined
            ? { languageProfileId: seerrOptions.languageProfileId }
            : {}),
        })

        if (!result.success) {
          const msg = result.message ?? 'Request failed'
          await updateDiscoveryRequestStatus(apertureRequestId, 'failed', {
            statusMessage: msg,
          })
          failed++
          errors.push({ tmdbId: item.tmdbId, title: item.title, message: msg })
        } else {
          await updateDiscoveryRequestStatus(apertureRequestId, 'submitted', {
            seerrRequestId: result.requestId,
          })
          submitted++
        }
      } catch (err) {
        failed++
        errors.push({
          tmdbId: item.tmdbId,
          title: item.title,
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      if (i < items.length - 1) {
        await sleep(200)
      }
    }

    return reply.send({ submitted, skipped, failed, errors })
  })
}

export default gapAnalysisRoutes
