import { z } from 'zod'

const text = z.string().max(2000)
const integer = (min: number, max: number) => z.string().regex(/^\d+$/).refine(value => Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max, `Expected an integer from ${min} to ${max}`)
const flag = z.enum(['true', 'false'])
const locale = z.string().min(2).max(80)
const history = z.object({ page: integer(1, 1000000).optional(), pageSize: integer(1, 1000).optional(), sortBy: text.optional() }).passthrough()
const similarity = z.object({ limit: integer(1, 1000).optional(), depth: integer(1, 5).optional() }).passthrough()
const streaming = z.object({
  includeStatuses: text.optional(), cachedPostersOnly: flag.optional(), country: text.optional(),
  language: locale.optional(), provider: text.optional(), limit: integer(1, 1000).optional(),
  offset: integer(0, 1000000).optional(), missingOnly: flag.optional(),
}).passthrough()

/** Supplements legacy handlers that previously declared query types only in TypeScript. */
export const queryContracts = {
  'GET /api/users/:id/watch-history': history,
  'GET /api/users/:id/series-watch-history': history,
  'GET /api/trakt/callback': z.object({ error: text.optional() }).passthrough(),
  'GET /api/settings/taste-profile': z.object({ mediaType: z.enum(['movie', 'series']).optional() }).passthrough(),
  'DELETE /api/settings/taste-profile/franchises/:franchiseName': z.object({ mediaType: z.enum(['movie', 'series', 'both']) }).passthrough(),
  'GET /api/settings/discovery-genre-strips/genre-options': z.object({ locale: locale.optional() }).passthrough(),
  'GET /api/settings/discovery-genre-strips/country-options': z.object({ locale: locale.optional() }).passthrough(),
  'GET /api/discover/person-profile': z.object({ name: z.string().trim().min(1).max(500) }).passthrough(),
  'GET /api/discover/person/:name/credits-gap': z.object({ showAll: flag.optional(), maxMissing: integer(1, 1000).optional() }).passthrough(),
  'GET /api/similarity/movie/:id': similarity,
  'GET /api/similarity/series/:id': similarity,
  'GET /api/similarity/graph/:source': z.object({ limit: integer(1, 1000).optional(), crossMedia: flag.optional() }).passthrough(),
  'GET /api/similarity/search': z.object({
    q: z.string().trim().min(1).max(2000), type: z.enum(['movie', 'series', 'both']).optional(),
    limit: integer(1, 1000).optional(), graph: flag.optional(), hideWatched: flag.optional(),
  }).passthrough(),
  'GET /api/discovery/streaming/popular': streaming,
  'GET /api/discovery/streaming/search': streaming.extend({ q: text.optional() }),
  'GET /api/discovery/streaming/providers': z.object({ country: text.optional() }).passthrough(),
  'GET /api/discovery/tmdb-genre-row': z.object({
    includeStatuses: text.optional(), mediaType: z.enum(['movie', 'movies', 'series', 'tv']).optional(),
    genreId: integer(1, 100000).optional(), genreIds: text.optional(), excludeGenreIds: text.optional(),
    limit: integer(1, 1000).optional(), withOriginCountry: text.optional(),
    yearStart: integer(1800, 2200).optional(), yearEnd: integer(1800, 2200).optional(),
  }).passthrough(),
  'GET /api/discovery/genres': z.object({ locale: locale.optional(), mediaType: z.enum(['movie', 'movies', 'series', 'tv']).optional() }).passthrough(),
  'GET /api/admin/gap-analysis/results': z.object({
    runId: z.string().uuid().optional(), collectionId: integer(1, 100000000).optional(),
    search: text.optional(), page: integer(1, 1000000).optional(), pageSize: integer(1, 1000).optional(),
    sortBy: text.optional(), sortDir: z.enum(['asc', 'desc']).optional(),
  }).passthrough(),
  'GET /api/admin/gap-analysis/collection-parts': z.object({ ids: z.string().regex(/^\d+(\s*,\s*\d+)*$/).max(20000) }).passthrough(),
}
