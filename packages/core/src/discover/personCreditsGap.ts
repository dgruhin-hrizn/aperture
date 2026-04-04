/**
 * Compare TMDb combined credits to visible library (movies/series tmdb_id).
 * Missing titles are grouped by media (movie/tv) + role kind (acting, director, producer, …).
 */

import { query, queryOne } from '../lib/db.js'
import {
  getCachedOrFetchCombinedCredits,
  normalizePersonNameKey,
  resolveTmdbPersonId,
  type TmdbCombinedCreditEntry,
  type TmdbCombinedCreditsResponse,
} from '../tmdb/person.js'
import { getImageUrl } from '../tmdb/client.js'

export interface PersonCreditsGapOptions {
  /** When true, include items from disabled libraries (only applies if library_config rows exist). */
  showAll?: boolean
  /** Max missing rows returned total (default 80). */
  maxMissing?: number
}

/** How this credit is classified for grouping (cast → actor; crew by job). */
export type CreditsRoleKind =
  | 'actor'
  | 'director'
  | 'producer'
  | 'writer'
  | 'creator'
  | 'other'

export interface PersonCreditsGapRow {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  /** `${mediaType}:${roleKind}` e.g. `movie:actor`, `tv:producer` */
  groupKey: string
  roleKind: CreditsRoleKind
  title: string
  year: number | null
  posterUrl: string | null
  character?: string
  job?: string
}

export interface PersonCreditsGapGroup {
  groupKey: string
  label: string
  rows: PersonCreditsGapRow[]
}

export interface PersonCreditsGapResult {
  tmdbPersonId: number | null
  inLibrary: PersonCreditsGapGroup[]
  missing: PersonCreditsGapGroup[]
}

const MEDIA_LABEL: Record<'movie' | 'tv', string> = {
  movie: 'Movies',
  tv: 'TV Series',
}

const ROLE_LABEL: Record<CreditsRoleKind, string> = {
  actor: 'Acting',
  director: 'Director',
  producer: 'Producer',
  writer: 'Writer',
  creator: 'Creator',
  other: 'Other crew',
}

/** Display order for `groupKey` values. */
const GROUP_ORDER: string[] = [
  'movie:actor',
  'movie:director',
  'movie:producer',
  'movie:writer',
  'movie:creator',
  'movie:other',
  'tv:actor',
  'tv:director',
  'tv:producer',
  'tv:writer',
  'tv:creator',
  'tv:other',
]

export function formatCreditsGapGroupLabel(groupKey: string): string {
  const parts = groupKey.split(':')
  const media = parts[0] as 'movie' | 'tv'
  const role = parts[1] as CreditsRoleKind
  const mediaL = MEDIA_LABEL[media] ?? media
  const roleL = ROLE_LABEL[role] ?? role
  return `${mediaL} · ${roleL}`
}

function groupSortIndex(groupKey: string): number {
  const i = GROUP_ORDER.indexOf(groupKey)
  return i === -1 ? 999 : i
}

/**
 * Classify crew jobs; cast rows are always `actor`.
 */
export function creditsRoleKindFromEntry(
  entry: TmdbCombinedCreditEntry,
  fromCast: boolean
): CreditsRoleKind {
  if (fromCast) return 'actor'
  const job = (entry.job || '').toLowerCase()
  if (/\bassistant\s+director\b/.test(job)) return 'other'
  if (/\bdirector\b|\bco-director\b/.test(job)) return 'director'
  if (/producer|executive producer|co-producer|associate producer/.test(job)) return 'producer'
  if (/writer|screenplay|screen writer|story|teleplay|written by/.test(job)) return 'writer'
  if (/creator|created by/.test(job)) return 'creator'
  return 'other'
}

function yearFromEntry(e: TmdbCombinedCreditEntry): number | null {
  const d = e.release_date || e.first_air_date
  if (!d || d.length < 4) return null
  const y = parseInt(d.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function displayTitle(e: TmdbCombinedCreditEntry): string {
  return (e.title || e.name || e.original_title || e.original_name || 'Unknown').trim()
}

function normalizeMediaType(entry: TmdbCombinedCreditEntry): 'movie' | 'tv' | null {
  const mt = entry.media_type
  if (mt === 'movie') return 'movie'
  if (mt === 'tv') return 'tv'
  return null
}

/**
 * One row per distinct credit: cast uses `movie:123:cast`; crew uses `movie:123:crew:<job>`.
 */
export function flattenCombinedCreditsWithRoles(
  credits: TmdbCombinedCreditsResponse
): Array<{ entry: TmdbCombinedCreditEntry; fromCast: boolean }> {
  const seen = new Set<string>()
  const out: Array<{ entry: TmdbCombinedCreditEntry; fromCast: boolean }> = []

  const push = (e: TmdbCombinedCreditEntry, fromCast: boolean): void => {
    const mt = normalizeMediaType(e)
    if (!mt || e.adult === true) return
    const key = fromCast
      ? `${mt}:${e.id}:cast`
      : `${mt}:${e.id}:crew:${(e.job || '').trim()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ entry: e, fromCast })
  }

  for (const c of credits.cast ?? []) {
    push(c, true)
  }
  for (const c of credits.crew ?? []) {
    push(c, false)
  }

  return out
}

/**
 * @deprecated Prefer {@link flattenCombinedCreditsWithRoles} for role-aware rows.
 * Flatten cast + crew into unique (media_type, id) rows (first occurrence wins).
 */
export function flattenCombinedCredits(
  credits: TmdbCombinedCreditsResponse
): TmdbCombinedCreditEntry[] {
  const seen = new Set<string>()
  const out: TmdbCombinedCreditEntry[] = []

  const push = (e: TmdbCombinedCreditEntry): void => {
    const mt = normalizeMediaType(e)
    if (!mt || e.adult === true) return
    const key = `${mt}:${e.id}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(e)
  }

  for (const c of credits.cast ?? []) {
    push(c)
  }
  for (const c of credits.crew ?? []) {
    push(c)
  }

  return out
}

function entryToRow(
  e: TmdbCombinedCreditEntry,
  fromCast: boolean
): PersonCreditsGapRow {
  const mt = normalizeMediaType(e) ?? 'movie'
  const roleKind = creditsRoleKindFromEntry(e, fromCast)
  const groupKey = `${mt}:${roleKind}`
  return {
    tmdbId: e.id,
    mediaType: mt,
    groupKey,
    roleKind,
    title: displayTitle(e),
    year: yearFromEntry(e),
    posterUrl: getImageUrl(e.poster_path ?? null, 'w185'),
    character: e.character,
    job: e.job,
  }
}

function partitionRowsIntoGroups(rows: PersonCreditsGapRow[]): PersonCreditsGapGroup[] {
  const map = new Map<string, PersonCreditsGapRow[]>()
  for (const r of rows) {
    const key = r.groupKey
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  const keys = [...map.keys()].sort((a, b) => groupSortIndex(a) - groupSortIndex(b))
  return keys.map((k) => ({
    groupKey: k,
    label: formatCreditsGapGroupLabel(k),
    rows: (map.get(k) ?? []).sort(sortRowsByDateDesc),
  }))
}

function sortRowsByDateDesc(a: PersonCreditsGapRow, b: PersonCreditsGapRow): number {
  const ya = a.year ?? 0
  const yb = b.year ?? 0
  return yb - ya
}

async function loadLibraryTmdbIds(showAll: boolean): Promise<{
  movieIds: Set<string>
  seriesIds: Set<string>
}> {
  const configCheck = await queryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM library_config'
  )
  const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0
  const filterByLibrary = hasLibraryConfigs && !showAll

  const libMovie = filterByLibrary
    ? `EXISTS (
        SELECT 1 FROM library_config lc
        WHERE lc.provider_library_id = m.provider_library_id
        AND lc.is_enabled = true
      )`
    : 'TRUE'

  const libSeries = filterByLibrary
    ? `EXISTS (
        SELECT 1 FROM library_config lc
        WHERE lc.provider_library_id = s.provider_library_id
        AND lc.is_enabled = true
      )`
    : 'TRUE'

  const movieRows = await query<{ tmdb_id: string }>(
    `SELECT DISTINCT m.tmdb_id::text AS tmdb_id
     FROM movies m
     WHERE m.tmdb_id IS NOT NULL AND trim(m.tmdb_id)::text != ''
     AND (${libMovie})`,
    []
  )
  const seriesRows = await query<{ tmdb_id: string }>(
    `SELECT DISTINCT s.tmdb_id::text AS tmdb_id
     FROM series s
     WHERE s.tmdb_id IS NOT NULL AND trim(s.tmdb_id)::text != ''
     AND (${libSeries})`,
    []
  )

  const movieIds = new Set<string>()
  const seriesIds = new Set<string>()
  for (const r of movieRows.rows) {
    if (r.tmdb_id) movieIds.add(String(r.tmdb_id))
  }
  for (const r of seriesRows.rows) {
    if (r.tmdb_id) seriesIds.add(String(r.tmdb_id))
  }
  return { movieIds, seriesIds }
}

function isInLibrary(
  entry: TmdbCombinedCreditEntry,
  movieIds: Set<string>,
  seriesIds: Set<string>
): boolean {
  const mt = normalizeMediaType(entry)
  if (!mt) return false
  const id = String(entry.id)
  if (mt === 'movie') return movieIds.has(id)
  return seriesIds.has(id)
}

/**
 * Credits missing from the visible library vs TMDb combined credits (grouped by role).
 */
export async function getPersonCreditsGap(
  decodedName: string,
  options: PersonCreditsGapOptions = {}
): Promise<PersonCreditsGapResult> {
  const maxMissing = Math.min(Math.max(1, options.maxMissing ?? 80), 200)
  const showAll = options.showAll === true

  const tmdbPersonId = await resolveTmdbPersonId(decodedName)
  if (tmdbPersonId == null) {
    return { tmdbPersonId: null, inLibrary: [], missing: [] }
  }

  const credits = await getCachedOrFetchCombinedCredits(decodedName, tmdbPersonId)
  if (!credits) {
    return { tmdbPersonId, inLibrary: [], missing: [] }
  }

  const flat = flattenCombinedCreditsWithRoles(credits)
  const { movieIds, seriesIds } = await loadLibraryTmdbIds(showAll)

  const inLibrary: PersonCreditsGapRow[] = []
  const missing: PersonCreditsGapRow[] = []

  for (const { entry, fromCast } of flat) {
    const mt = normalizeMediaType(entry)
    if (!mt) continue
    const row = entryToRow(entry, fromCast)
    if (isInLibrary(entry, movieIds, seriesIds)) {
      inLibrary.push(row)
    } else {
      missing.push(row)
    }
  }

  missing.sort(sortRowsByDateDesc)
  const cappedMissing = missing.slice(0, maxMissing)
  const maxInLib = 100
  inLibrary.sort(sortRowsByDateDesc)
  const cappedInLib = inLibrary.slice(0, maxInLib)

  return {
    tmdbPersonId,
    inLibrary: partitionRowsIntoGroups(cappedInLib),
    missing: partitionRowsIntoGroups(cappedMissing),
  }
}
