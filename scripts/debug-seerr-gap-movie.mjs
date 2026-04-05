#!/usr/bin/env node
/**
 * Debug Seerr vs gap-analysis filtering for one movie TMDb id.
 *
 * Mirrors packages/core/src/seerr/provider.ts:
 *   - getSeerrConfig-equivalent (reads system_settings when DATABASE_URL is set)
 *   - GET /api/v1/movie/:tmdbId (same path as getMovieDetails)
 *   - Decision logic aligned with getMediaStatus + gap scan filter (exclude if exists || requested)
 *
 * Usage:
 *   DATABASE_URL=... node scripts/debug-seerr-gap-movie.mjs [tmdbId]
 *   # or rely on .env.local (same as db:migrate)
 *
 * Override without DB:
 *   SEERR_URL=http://192.168.1.8:5055 SEERR_API_KEY=... node scripts/debug-seerr-gap-movie.mjs 1226863
 *
 * @see packages/core/src/seerr/provider.ts — getMediaStatus, getMovieDetails
 * @see packages/core/src/gap-analysis/index.ts — rowsToInsert filter after batchGetMediaStatus
 */

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env.local') })

const { Pool } = pg

function maskKey(k) {
  if (!k || k.length < 8) return '(short)'
  return `${k.slice(0, 4)}…${k.slice(-4)}`
}

function logSection(title) {
  console.log(`\n${'═'.repeat(72)}\n ${title}\n${'═'.repeat(72)}`)
}

/**
 * Same rules as getMediaStatus() in provider.ts (keep in sync manually).
 */
function computeMediaStatusFromDetails(details) {
  if (!details) return null

  const mediaInfo = details.mediaInfo

  if (!mediaInfo) {
    return {
      exists: false,
      status: 'unknown',
      requested: false,
    }
  }

  const statusMap = {
    1: 'unknown',
    2: 'pending',
    3: 'processing',
    4: 'partially_available',
    5: 'available',
  }

  const latestRequest = mediaInfo.requests?.[0]
  const status4k = mediaInfo.status4k
  const code = (s) => {
    if (s == null || s === '') return undefined
    const n = typeof s === 'number' ? s : Number(s)
    return Number.isFinite(n) ? n : undefined
  }
  const hd = code(mediaInfo.status)
  const fourK = code(status4k)
  const inLibrary = (s) => s != null && s >= 4
  const inPipeline = (s) => s === 2 || s === 3

  return {
    exists: inLibrary(hd) || inLibrary(fourK),
    status: statusMap[hd ?? 1] ?? 'unknown',
    requested:
      Boolean(mediaInfo.requests?.length) ||
      inPipeline(hd) ||
      inPipeline(fourK),
    _debug: {
      rawStatus: mediaInfo.status,
      rawStatus4k: status4k,
      requestCount: mediaInfo.requests?.length ?? 0,
      inLibraryHD: inLibrary(hd),
      inLibrary4k: inLibrary(fourK),
      inPipelineHD: inPipeline(hd),
      inPipeline4k: inPipeline(fourK),
    },
  }
}

async function loadSeerrFromDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return null
  }
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const r = await pool.query(
      `SELECT key, value FROM system_settings WHERE key IN ('seerr_url', 'seerr_api_key', 'seerr_enabled')`
    )
    const map = Object.fromEntries(r.rows.map((row) => [row.key, row.value]))
    const url = map.seerr_url?.replace(/\/$/, '') || null
    const apiKey = map.seerr_api_key || null
    const enabled = map.seerr_enabled === 'true'
    return { url, apiKey, enabled, source: 'system_settings' }
  } catch (err) {
    console.warn('Could not read system_settings (DATABASE_URL):', err.message || err)
    return null
  } finally {
    await pool.end()
  }
}

async function main() {
  const tmdbId = parseInt(process.argv[2] || '1226863', 10)
  if (!Number.isFinite(tmdbId)) {
    console.error('Usage: node scripts/debug-seerr-gap-movie.mjs [tmdbId]')
    process.exit(1)
  }

  logSection('Configuration')
  let url = process.env.SEERR_URL?.replace(/\/$/, '')
  let apiKey = process.env.SEERR_API_KEY
  let enabled = process.env.SEERR_ENABLED !== 'false'
  let source = 'env'

  const fromDb = await loadSeerrFromDb()
  if (fromDb?.url && fromDb?.apiKey) {
    if (!process.env.SEERR_URL && !process.env.SEERR_API_KEY) {
      url = fromDb.url
      apiKey = fromDb.apiKey
      enabled = fromDb.enabled
      source = fromDb.source
    } else {
      console.log('Note: SEERR_* env vars override database settings for this run.')
    }
  }

  console.log('Source:', source)
  console.log('Seerr enabled (for isSeerrConfigured parity):', enabled)
  console.log('Seerr URL:', url || '(missing)')
  console.log('API key:', apiKey ? maskKey(apiKey) : '(missing)')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '(set)' : '(not set)')
  console.log('TMDb movie id:', tmdbId)

  if (!url || !apiKey) {
    console.error('\nFATAL: Need seerr_url + seerr_api_key from DB (DATABASE_URL) or SEERR_URL + SEERR_API_KEY')
    process.exit(2)
  }

  if (!enabled) {
    console.warn('\nWARN: seerr_enabled is false — gap analysis will NOT call Seerr (isSeerrConfigured).')
  }

  const endpoint = `${url}/api/v1/movie/${tmdbId}`
  logSection('HTTP: same as getMovieDetails()')
  console.log('GET', endpoint)
  console.log('Header X-Api-Key:', maskKey(apiKey))

  const started = Date.now()
  let res
  try {
    res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
    })
  } catch (err) {
    console.error('\nFETCH FAILED (network / DNS / refused):', err)
    process.exit(3)
  }

  const elapsed = Date.now() - started
  const text = await res.text()
  console.log(`Response: ${res.status} ${res.statusText} (${elapsed}ms)`)
  console.log('Body length:', text.length)

  if (!res.ok) {
    console.error('\nNon-OK response body (first 2k):')
    console.error(text.slice(0, 2000))
    process.exit(4)
  }

  let details
  try {
    details = JSON.parse(text)
  } catch {
    console.error('Invalid JSON body')
    process.exit(5)
  }

  logSection('mediaInfo (what getMediaStatus reads)')
  const mi = details.mediaInfo
  if (!mi) {
    console.log('(no mediaInfo — getMediaStatus returns requested:false, exists:false)')
  } else {
    console.log(JSON.stringify(mi, null, 2))
  }

  logSection('Computed: getMediaStatus parity')
  const st = computeMediaStatusFromDetails(details)
  console.log(JSON.stringify(st, null, 2))

  logSection('Gap analysis filter (after batchGetMediaStatus)')
  if (!enabled) {
    console.log('Seerr not configured/enabled → filter SKIPPED → row would be INSERTed if missing from library.')
  } else if (!st) {
    console.log('getMovieDetails returned null → no map entry → row KEPT (safe default).')
  } else {
    const exclude = st.exists || st.requested
    console.log('exclude = exists || requested =', st.exists, '||', st.requested, '=', exclude)
    if (exclude) {
      console.log('→ Row would be DROPPED before INSERT (not shown as a gap).')
    } else {
      console.log('→ Row would be INSERTed (still a gap in Seerr terms).')
    }
  }

  logSection('Raw title from Seerr')
  console.log(details.title, details.releaseDate || '')

  console.log('\nDone.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
