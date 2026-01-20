/**
 * Maintenance OpenAPI Schemas
 */

export const maintenanceSchemas = {
  // Missing poster item
  MissingPosterItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      embyId: { type: 'string' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      type: { type: 'string', enum: ['movie', 'series'] },
      tmdbId: { type: 'string', nullable: true },
    },
  },

  // Scan result
  PosterScanResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      movies: { type: 'array', items: { $ref: 'MissingPosterItem#' } },
      series: { type: 'array', items: { $ref: 'MissingPosterItem#' } },
      totalMissing: { type: 'integer' },
      scannedAt: { type: 'string', format: 'date-time' },
      summary: {
        type: 'object',
        properties: {
          moviesWithMissingPosters: { type: 'integer' },
          seriesWithMissingPosters: { type: 'integer' },
          moviesWithTmdbId: { type: 'integer' },
          seriesWithTmdbId: { type: 'integer' },
          moviesRepairable: { type: 'integer' },
          seriesRepairable: { type: 'integer' },
        },
      },
    },
  },

  // Repair result
  PosterRepairResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      jobId: { type: 'string', format: 'uuid' },
      total: { type: 'integer' },
      skippedNoTmdbId: { type: 'integer' },
      message: { type: 'string' },
    },
  },
} as const

// Route-specific schemas
export const scanPostersSchema = {
  tags: ['admin'],
  summary: 'Scan for missing posters',
  description: 'Scan Emby for items with missing poster images',
}

export const repairPostersSchema = {
  tags: ['admin'],
  summary: 'Repair missing posters',
  description: 'Repair selected items by fetching posters from TMDB and pushing to Emby',
  body: {
    type: 'object',
    additionalProperties: true,
    required: ['items'],
    properties: {
      items: { type: 'array', items: { $ref: 'MissingPosterItem#' } },
    },
  },
}
