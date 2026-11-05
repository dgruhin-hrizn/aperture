import { z } from 'zod'
import { validateGenreStripRows, GENRE_STRIP_MAX_ROWS, GENRE_STRIP_MAX_GENRES_PER_ROW, GENRE_STRIP_MAX_EXCLUDE_GENRES_PER_ROW } from '@aperture/core'
import cron from 'node-cron'

const positiveId = z.number().int().positive()
const externalSources = z.enum(['tmdb_popular', 'tmdb_trending_day', 'tmdb_trending_week', 'tmdb_top_rated', 'mdblist'])
// Keep legacy number[][] and modern row objects; the canonical parser owns cross-field rules.
const genreIds = z.array(positiveId).min(1).max(GENRE_STRIP_MAX_GENRES_PER_ROW)
const genreRows = z.array(z.union([genreIds, z.object({
  genreIds, limit: z.number().optional().nullable(), label: z.string().optional(),
  originCountry: z.string().optional(), excludeGenreIds: z.array(positiveId).max(GENRE_STRIP_MAX_EXCLUDE_GENRES_PER_ROW).optional(),
  yearStart: z.union([z.number(), z.string().max(20), z.null()]).optional(),
  yearEnd: z.union([z.number(), z.string().max(20), z.null()]).optional(), yearEndCurrent: z.boolean().optional(),
})])).max(GENRE_STRIP_MAX_ROWS).refine(rows => validateGenreStripRows(rows) !== null, 'Invalid genre strip rows')

export const libraryBodies = {
  'POST /api/setup/library-image/:libraryType': z.object({
    dataBase64: z.string().min(1).max(15_000_000), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    filename: z.string().max(255).optional(),
  }),
  'PATCH /api/settings/discovery-genre-strips': z.object({ movieGenreRows: genreRows.optional(), seriesGenreRows: genreRows.optional() }),
  'POST /api/top-picks/preview': z.object({
    mediaType: z.enum(['movies', 'series']), source: z.enum(['emby_history', ...externalSources.options, 'hybrid']),
    hybridExternalSource: externalSources.optional(), mdblistListId: positiveId.optional(),
    mdblistSort: z.string().max(100).optional(), limit: z.number().int().min(1).max(1000).optional(),
    languages: z.array(z.string().min(1).max(20)).max(100).optional(), includeUnknownLanguage: z.boolean().optional(),
  }),
  'POST /api/top-picks/request-missing': z.object({
    items: z.array(z.object({ tmdbId: positiveId, title: z.string().min(1).max(1000), mediaType: z.enum(['movie', 'tv']) })).min(1).max(1000),
    limit: z.number().int().min(1).max(1000).optional(),
  }),
  'PATCH /api/top-picks/auto-request/config': z.object({
    moviesAutoRequestEnabled: z.boolean().optional(), moviesAutoRequestLimit: z.number().int().min(0).max(1000).optional(),
    seriesAutoRequestEnabled: z.boolean().optional(), seriesAutoRequestLimit: z.number().int().min(0).max(1000).optional(),
    autoRequestCron: z.string().min(1).max(200).refine(cron.validate, 'Invalid cron expression').optional(),
  }),
  'POST /api/maintenance/posters/repair': z.object({
    items: z.array(z.object({
      id: z.string().min(1).max(255), title: z.string().min(1).max(1000), year: z.number().int().nullable(),
      type: z.enum(['movie', 'series']), tmdbId: z.string().max(100).nullable(), imdbId: z.string().max(100).nullable(), hasBackdrop: z.boolean(),
    })).min(1).max(10000),
  }),
  'POST /api/admin/gap-analysis/request': z.object({
    items: z.array(z.object({ tmdbId: positiveId, mediaType: z.enum(['movie', 'series']), title: z.string().min(1).max(1000) })).min(1).max(1000),
    seerrOptions: z.object({ rootFolder: z.string().max(2000).optional(), profileId: z.number().int().nonnegative().optional(), serverId: z.number().int().nonnegative().optional(), is4k: z.boolean().optional(), languageProfileId: z.number().int().nonnegative().optional() }).optional(),
  }),
}
