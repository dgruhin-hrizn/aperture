import { AsyncLocalStorage } from 'node:async_hooks'
import { query as rawQuery, type QueryResult } from '../lib/db.js'

export interface CatalogScope {
  movieIds: string[]
  seriesIds: string[]
}
export const encoreCatalogScope = new AsyncLocalStorage<CatalogScope>()

/** Scope every catalog reference, including joins and aggregates, before data reaches a tool. */
export function scopeCatalogQuery(text: string, params: unknown[], scope: CatalogScope) {
  const movies = `$${params.length + 1}`,
    series = `$${params.length + 2}`
  const ctes = `movies AS (SELECT * FROM public.movies WHERE provider_item_id = ANY(${movies}::text[])
    AND NOT EXISTS (SELECT 1 FROM library_config lc WHERE lc.provider_library_id = movies.provider_library_id AND NOT lc.is_enabled)),
    series AS (SELECT * FROM public.series WHERE provider_item_id = ANY(${series}::text[])
    AND NOT EXISTS (SELECT 1 FROM library_config lc WHERE lc.provider_library_id = series.provider_library_id AND NOT lc.is_enabled)),
    episodes AS (SELECT e.* FROM public.episodes e JOIN series s ON s.id = e.series_id)`
  // Tool SQL is authored in this repository; identifiers and query text never come from a client.
  const prefix = /^\s*WITH\s/i.test(text)
    ? text.replace(/^\s*WITH\s/i, `WITH ${ctes}, `)
    : `WITH ${ctes} ${text}`
  return { text: prefix, params: [...params, scope.movieIds, scope.seriesIds] }
}

/** For shared services whose background callers use the full catalog. */
export async function queryWithinCatalog<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const scope = encoreCatalogScope.getStore()
  if (!scope || !/\b(movies|series|episodes)\b/.test(text)) return rawQuery<T>(text, params)
  const scoped = scopeCatalogQuery(text, params, scope)
  return rawQuery<T>(scoped.text, scoped.params)
}

export async function queryOneWithinCatalog<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  return (await queryWithinCatalog<T>(text, params)).rows[0] ?? null
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (!encoreCatalogScope.getStore()) throw new Error('Encore catalog queries require an authenticated scope')
  return queryWithinCatalog<T>(text, params)
}
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  return (await query<T>(text, params)).rows[0] ?? null
}
