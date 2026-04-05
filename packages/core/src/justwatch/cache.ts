import { query, queryOne } from '../lib/db.js'

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

/** In-memory hot cache: avoids a Postgres read on every streaming strip hit (same process). */
const MAX_L1_KEYS = 500
const l1 = new Map<string, { payload: unknown; fetchedAtMs: number }>()

/** In-flight JustWatch fetches per cache key (parallel strip requests share one upstream call). */
const inflight = new Map<string, Promise<{ raw: unknown; stale: boolean }>>()

export function streamingCacheTtlMs(): number {
  const raw = process.env.JUSTWATCH_CACHE_TTL_MS
  if (!raw) return DEFAULT_TTL_MS
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS
}

function l1Prune(): void {
  while (l1.size > MAX_L1_KEYS) {
    const k = l1.keys().next().value
    if (k === undefined) break
    l1.delete(k)
  }
}

function l1Set(key: string, payload: unknown, fetchedAtMs: number): void {
  l1.delete(key)
  l1.set(key, { payload, fetchedAtMs })
  l1Prune()
}

export async function getCachedPayload(cacheKey: string): Promise<{ payload: unknown; stale: boolean } | null> {
  const mem = l1.get(cacheKey)
  if (mem) {
    const age = Date.now() - mem.fetchedAtMs
    if (age <= streamingCacheTtlMs()) {
      return { payload: mem.payload, stale: false }
    }
    l1.delete(cacheKey)
  }

  const row = await queryOne<{ payload: unknown; fetched_at: Date }>(
    `SELECT payload, fetched_at FROM justwatch_chart_cache WHERE cache_key = $1`,
    [cacheKey]
  )
  if (!row) return null
  const fetchedAtMs = new Date(row.fetched_at).getTime()
  const age = Date.now() - fetchedAtMs
  const stale = age > streamingCacheTtlMs()
  if (!stale) {
    l1Set(cacheKey, row.payload, fetchedAtMs)
  }
  return { payload: row.payload, stale }
}

export async function setCachedPayload(cacheKey: string, payload: unknown): Promise<void> {
  await query(
    `INSERT INTO justwatch_chart_cache (cache_key, payload, fetched_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (cache_key) DO UPDATE SET
       payload = EXCLUDED.payload,
       fetched_at = NOW()`,
    [cacheKey, payload]
  )
  l1Set(cacheKey, payload, Date.now())
}

export function buildCacheKey(parts: Record<string, string | number | null | undefined>): string {
  const entries = Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${k}=${String(v)}`).join('&')
}

/**
 * Return fresh cache hit, or exactly one JustWatch fetch per key while concurrent callers wait on the same promise.
 */
export async function loadCachedOrFetch(
  cacheKey: string,
  fetcher: () => Promise<unknown>
): Promise<{ raw: unknown; stale: boolean }> {
  const cached = await getCachedPayload(cacheKey)
  if (cached && !cached.stale) {
    return { raw: cached.payload, stale: false }
  }

  let p = inflight.get(cacheKey)
  if (!p) {
    p = (async () => {
      try {
        const raw = await fetcher()
        await setCachedPayload(cacheKey, raw)
        return { raw, stale: false }
      } catch {
        if (cached) {
          return { raw: cached.payload, stale: true }
        }
        throw new Error('JUSTWATCH_UNAVAILABLE')
      }
    })()
    inflight.set(cacheKey, p)
  }

  try {
    return await p
  } finally {
    inflight.delete(cacheKey)
  }
}
