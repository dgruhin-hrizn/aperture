/**
 * Watching (Shows You Watch) OpenAPI Schemas
 */

export const watchingSchemas = {
  // Upcoming episode
  UpcomingEpisode: {
    type: 'object',
    properties: {
      seasonNumber: { type: 'integer' },
      episodeNumber: { type: 'integer' },
      title: { type: 'string' },
      airDate: { type: 'string', format: 'date' },
      source: { type: 'string', enum: ['emby', 'tmdb'] },
    },
  },

  // Watching series item
  WatchingSeries: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      seriesId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      overview: { type: 'string', nullable: true },
      communityRating: { type: 'number', nullable: true },
      network: { type: 'string', nullable: true },
      status: { type: 'string', nullable: true },
      totalSeasons: { type: 'integer', nullable: true },
      totalEpisodes: { type: 'integer', nullable: true },
      addedAt: { type: 'string', format: 'date-time' },
      upcomingEpisode: { $ref: 'UpcomingEpisode#' },
    },
  },

  // Watching list response
  WatchingListResponse: {
    type: 'object',
    properties: {
      series: { type: 'array', items: { $ref: 'WatchingSeries#' } },
      total: { type: 'integer' },
    },
  },
} as const

// Route-specific schemas
export const getWatchingSchema = {
  tags: ['watching'],
  summary: 'Get watching list',
  description: 'List user\'s watching series with upcoming episode info',
}

export const getWatchingIdsSchema = {
  tags: ['watching'],
  summary: 'Get watching series IDs',
  description: 'Get list of series IDs the user is watching (for quick UI checks)',
}

export const addToWatchingSchema = {
  tags: ['watching'],
  summary: 'Add to watching',
  description: 'Add series to user\'s watching list',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid' },
    },
  },
}

export const removeFromWatchingSchema = {
  tags: ['watching'],
  summary: 'Remove from watching',
  description: 'Remove series from user\'s watching list',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid' },
    },
  },
}

export const refreshWatchingSchema = {
  tags: ['watching'],
  summary: 'Refresh watching library',
  description: 'Regenerate user\'s watching library in Emby',
}

export const checkWatchingSchema = {
  tags: ['watching'],
  summary: 'Check if watching',
  description: 'Check if a specific series is in user\'s watching list',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid' },
    },
  },
}
