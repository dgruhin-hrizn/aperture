import { query } from '../lib/db.js'
import { AsyncCache } from '../lib/asyncCache.js'

interface PeopleSqlRow {
  name: string | null
  credits: number
  movie_credits: number
  series_credits: number
  full_total: string
}
const pages = new AsyncCache<PeopleSqlRow[]>(30_000, 200)

export interface ListPeopleBrowseOptions {
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'credits'
  /** When true, include items from disabled libraries (only applies if library_config rows exist). */
  showAll?: boolean
}

export interface PersonBrowseRow {
  name: string
  credits: number
  movieCredits: number
  seriesCredits: number
  tmdbProfilePath?: string | null
}

export interface ListPeopleBrowseResult {
  people: PersonBrowseRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * List distinct people (actors + directors) appearing in synced movies and series,
 * with optional library visibility matching the main Browse lists.
 */
export async function listPeopleForBrowse(
  options: ListPeopleBrowseOptions = {}
): Promise<ListPeopleBrowseResult> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(Math.max(1, options.pageSize ?? 50), 50)
  const offset = (page - 1) * pageSize
  const sortBy = options.sortBy === 'credits' ? 'credits' : 'name'
  const search = options.search?.trim() ?? ''
  const showAll = options.showAll === true

  // Visibility is rechecked even on a cache hit: disabling a library immediately changes the key.
  const configs = await query<{ provider_library_id: string; is_enabled: boolean }>(
    'SELECT provider_library_id, is_enabled FROM library_config'
  )
  const enabledIds = [
    ...new Set(configs.rows.filter((row) => row.is_enabled).map((row) => row.provider_library_id)),
  ].sort()
  const filterByLibrary = configs.rows.length > 0 && !showAll
  const libMovie = filterByLibrary ? 'm.provider_library_id = ANY($4::text[])' : 'TRUE'
  const libSeries = filterByLibrary ? 's.provider_library_id = ANY($4::text[])' : 'TRUE'

  const orderClause = sortBy === 'credits' ? 'credits DESC NULLS LAST, name ASC' : 'name ASC'

  const searchParam = search.length > 0 ? search : null

  const sql = `
WITH all_contributions AS (
  SELECT trim(a->>'name') AS name, 'movie'::text AS media_kind
  FROM movies m
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.actors, '[]'::jsonb)) AS a
  WHERE trim(COALESCE(a->>'name', '')) != ''
  AND (${libMovie})
  UNION ALL
  SELECT trim(dir) AS name, 'movie'::text
  FROM movies m
  CROSS JOIN LATERAL unnest(COALESCE(m.directors, ARRAY[]::text[])) AS u(dir)
  WHERE trim(dir) != ''
  AND (${libMovie})
  UNION ALL
  SELECT trim(a->>'name') AS name, 'series'::text
  FROM series s
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.actors, '[]'::jsonb)) AS a
  WHERE trim(COALESCE(a->>'name', '')) != ''
  AND (${libSeries})
  UNION ALL
  SELECT trim(dir) AS name, 'series'::text
  FROM series s
  CROSS JOIN LATERAL unnest(COALESCE(s.directors, ARRAY[]::text[])) AS u(dir)
  WHERE trim(dir) != ''
  AND (${libSeries})
),
agg AS (
  SELECT
    name,
    COUNT(*)::int AS credits,
    COUNT(*) FILTER (WHERE media_kind = 'movie')::int AS movie_credits,
    COUNT(*) FILTER (WHERE media_kind = 'series')::int AS series_credits
  FROM all_contributions
  GROUP BY name
),
filtered AS (
  SELECT * FROM agg
  WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
)
SELECT page.*, totals.full_total
FROM (SELECT COUNT(*)::bigint AS full_total FROM filtered) totals
LEFT JOIN LATERAL (
  SELECT name, credits, movie_credits, series_credits FROM filtered
  ORDER BY ${orderClause}
  LIMIT $2 OFFSET $3
) page ON TRUE
ORDER BY ${orderClause}
`

  const key = JSON.stringify([
    filterByLibrary ? enabledIds : null,
    sortBy,
    searchParam,
    pageSize,
    offset,
  ])
  const rows = await pages.get(
    key,
    async () =>
      (
        await query<PeopleSqlRow>(
          sql,
          filterByLibrary
            ? [searchParam, pageSize, offset, enabledIds]
            : [searchParam, pageSize, offset]
        )
      ).rows
  )
  const total = rows.length > 0 ? parseInt(rows[0].full_total, 10) : 0

  const visibleRows = rows.filter((r) => r.name !== null)
  const cachedPortraits = visibleRows.length
    ? await query<{ name_key: string; profile_path: string }>(
        'SELECT name_key, profile_path FROM person_tmdb_profile_cache WHERE name_key = ANY($1::text[]) AND profile_path IS NOT NULL AND not_found = false',
        [visibleRows.map((r) => r.name!.trim().toLowerCase())]
      )
    : { rows: [] }
  const portraits = new Map(cachedPortraits.rows.map((r) => [r.name_key, r.profile_path]))
  return {
    people: rows
      .filter((r) => r.name !== null)
      .map((r) => ({
        name: r.name!,
        credits: r.credits,
        movieCredits: r.movie_credits,
        seriesCredits: r.series_credits,
        tmdbProfilePath: portraits.get(r.name!.trim().toLowerCase()) ?? null,
      })),
    total,
    page,
    pageSize,
  }
}
