import {
  createDiscoveryRequest,
  createSeerrRequest,
  getSeerrMovieDetails,
  hasExistingRequest,
  updateDiscoveryRequestStatus,
} from '@aperture/core'
import { getPool, queryOne } from './db.js'

type RequestOptions = NonNullable<Parameters<typeof createSeerrRequest>[2]>
type Submission =
  | { kind: 'submitted'; apertureRequestId: string; seerrRequestId?: number }
  | { kind: 'duplicate'; request?: Awaited<ReturnType<typeof hasExistingRequest>> }
  | { kind: 'unverified' | 'failed'; message: string; apertureRequestId?: string }

const blocked = new Set(['pending', 'submitted', 'approved', 'available'])
const unconfirmed = 'Awaiting Seerr confirmation. Check Seerr before retrying.'

async function movieState(tmdbId: number, is4k: boolean) {
  const movie = await getSeerrMovieDetails(tmdbId)
  if (movie?.id !== tmdbId) return null
  const info = movie.mediaInfo
  const status = Number(is4k ? info?.status4k : info?.status)
  const active = info?.requests?.filter((row) => Boolean(row.is4k) === is4k && [1, 2].includes(Number(row.status))) ?? []
  return { blocked: status >= 2 || active.length > 0, active }
}

/** Serialize manual requests across both API routes, including concurrent requests by different users. */
export async function submitTrackedSeerrRequest(input: {
  userId: string
  mediaType: 'movie' | 'series'
  tmdbId: number
  title: string
  options: RequestOptions
  discoveryCandidateId?: string
  source?: 'discovery' | 'gap_analysis'
}): Promise<Submission> {
  const { userId, mediaType, tmdbId, title, options } = input
  const movie = mediaType === 'movie'
  const is4k = options.is4k === true
  const key = movie ? 14751510 : 14751511
  const pool = getPool()
  // Limit connections reserved for advisory locks so their work can still use the shared pool.
  if (pool.waitingCount || pool.totalCount - pool.idleCount >= 12)
    return { kind: 'unverified', message: 'The request service is busy. Try again shortly.' }
  const lock = await pool.connect()
  let locked = false
  let releaseError: Error | undefined
  try {
    const ownership = await lock.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked', [key, tmdbId]
    )
    locked = ownership.rows[0]?.locked === true
    if (!locked) return { kind: 'duplicate' }

    const previous = await hasExistingRequest(userId, tmdbId, mediaType)
    const before = movie ? await movieState(tmdbId, is4k) : null
    if (movie && !before) return { kind: 'unverified', message: 'Could not verify current Seerr status.' }
    if (previous?.status === 'pending' && previous.statusMessage === unconfirmed && before) {
      const request = before.active.find((row) => options.userId != null
        && row.requestedBy?.id === options.userId
        && Date.parse(row.createdAt) >= new Date(previous.createdAt).getTime() - 5000)
      if (request) {
        await updateDiscoveryRequestStatus(previous.id, 'submitted', {
          seerrRequestId: request.id, statusMessage: 'Confirmed in Seerr',
        })
        return { kind: 'submitted', apertureRequestId: previous.id, seerrRequestId: request.id }
      }
    }
    if ((previous && blocked.has(previous.status)) || before?.blocked) {
      return { kind: 'duplicate', request: previous }
    }
    if (movie && await queryOne(
      "SELECT 1 FROM discovery_requests WHERE media_type = 'movie' AND tmdb_id = $1 AND status = 'pending' AND status_message = $2 LIMIT 1",
      [tmdbId, unconfirmed]
    )) return { kind: 'duplicate' }
    if (movie && input.source === 'gap_analysis' && await queryOne(
      'SELECT 1 FROM movies WHERE tmdb_id = $1 LIMIT 1', [String(tmdbId)]
    )) return { kind: 'duplicate' }

    const apertureRequestId = await createDiscoveryRequest(
      userId, mediaType, tmdbId, title, input.discoveryCandidateId, input.source, unconfirmed
    )
    let result: Awaited<ReturnType<typeof createSeerrRequest>>
    try {
      result = await createSeerrRequest(tmdbId, movie ? 'movie' : 'tv', options)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not prepare Seerr request'
      await updateDiscoveryRequestStatus(apertureRequestId, 'failed', { statusMessage: message })
      return { kind: 'failed', apertureRequestId, message }
    }
    if (result.success) {
      await updateDiscoveryRequestStatus(apertureRequestId, 'submitted', { seerrRequestId: result.requestId, statusMessage: 'Submitted to Seerr' })
      return { kind: 'submitted', apertureRequestId, seerrRequestId: result.requestId }
    }

    if (result.uncertain) {
      const current = movie ? await movieState(tmdbId, is4k).catch(() => null) : null
      const request = current?.active.find((row) => options.userId != null
        && row.requestedBy?.id === options.userId
        && !before?.active.some((previous) => previous.id === row.id))
      if (request) {
        await updateDiscoveryRequestStatus(apertureRequestId, 'submitted', { seerrRequestId: request.id, statusMessage: 'Confirmed in Seerr' })
        return { kind: 'submitted', apertureRequestId, seerrRequestId: request.id }
      }
      await updateDiscoveryRequestStatus(apertureRequestId, 'pending', { statusMessage: unconfirmed })
      return { kind: 'unverified', apertureRequestId, message: unconfirmed }
    }
    const message = result.message ?? 'Seerr rejected the request'
    await updateDiscoveryRequestStatus(apertureRequestId, 'failed', { statusMessage: message })
    return { kind: 'failed', apertureRequestId, message }
  } finally {
    if (locked) {
      try {
        await lock.query('SELECT pg_advisory_unlock($1, $2)', [key, tmdbId])
      } catch (err) {
        releaseError = err instanceof Error ? err : new Error('Could not release Seerr request lock')
      }
    }
    lock.release(releaseError)
  }
}
