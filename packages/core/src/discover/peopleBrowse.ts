import { query, queryOne } from '../lib/db.js'

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

  const orderClause =
    sortBy === 'credits'
      ? 'credits DESC NULLS LAST, name ASC'
      : 'name ASC'

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
SELECT name, credits, movie_credits, series_credits,
       COUNT(*) OVER()::bigint AS full_total
FROM filtered
ORDER BY ${orderClause}
LIMIT $2 OFFSET $3
`

  const result = await query<{
    name: string
    credits: number
    movie_credits: number
    series_credits: number
    full_total: string
  }>(sql, [searchParam, pageSize, offset])

  const rows = result.rows
  const total = rows.length > 0 ? parseInt(rows[0].full_total, 10) : 0

  return {
    people: rows.map((r) => ({
      name: r.name,
      credits: r.credits,
      movieCredits: r.movie_credits,
      seriesCredits: r.series_credits,
    })),
    total,
    page,
    pageSize,
  }
}
