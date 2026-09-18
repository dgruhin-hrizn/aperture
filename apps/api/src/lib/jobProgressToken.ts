import { createHmac, timingSafeEqual } from 'crypto'
import { getEnv } from '../config/env.js'

/**
 * Short-lived, signed tokens that authorize reading ONE job's progress.
 *
 * Why this exists: a database restore runs `pg_restore --clean`, which drops and
 * recreates every table — including `sessions`. The admin performing the restore
 * therefore loses their own session partway through, and every subsequent poll of
 * /api/jobs/progress/:jobId returns 401. The UI used to treat that 401 as "the job
 * finished", so a 30-minute restore looked like it completed in seconds.
 *
 * A session cannot survive an operation that deletes sessions, so progress polling
 * needs credentials that do not live in the database. These tokens are HMAC-signed
 * with SESSION_SECRET and carry their own expiry, so verifying one touches nothing
 * but memory.
 *
 * Scope is deliberately tiny: a token authorizes reading the progress of the single
 * job ID it was minted for, and nothing else.
 */

const TOKEN_VERSION = 'v1'

/** Long enough to cover a large restore; short enough to be uninteresting if leaked. */
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function getSigningSecret(): string {
  // Mirrors the secret used for session cookies in server.ts.
  return process.env.SESSION_SECRET || getEnv().SESSION_SECRET
}

function sign(payload: string): string {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
}

/**
 * Mint a token authorizing progress reads for `jobId`.
 * Format: v1.<jobId>.<expiresAtMs>.<signature>
 */
export function createJobProgressToken(jobId: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs
  const payload = `${TOKEN_VERSION}.${jobId}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

/**
 * Verify that `token` authorizes progress reads for `jobId`.
 * Returns false for any malformed, mismatched, expired, or badly signed token.
 */
export function verifyJobProgressToken(token: string | undefined, jobId: string): boolean {
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 4) return false

  const [version, tokenJobId, expiresAtRaw, signature] = parts
  if (version !== TOKEN_VERSION) return false

  // Compare job IDs before anything else: a token is valid for exactly one job.
  if (tokenJobId !== jobId) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  const expected = sign(`${version}.${tokenJobId}.${expiresAtRaw}`)

  // Constant-time compare; timingSafeEqual throws on length mismatch.
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signature)
  if (expectedBuf.length !== actualBuf.length) return false

  return timingSafeEqual(expectedBuf, actualBuf)
}
