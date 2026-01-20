/**
 * Watching (Shows You Watch) OpenAPI Schemas
 * 
 * "Shows You Watch" feature for tracking currently-watching series.
 * Creates a virtual library in the media server for easy access.
 */

export const watchingSchemas = {
  // Upcoming episode
  UpcomingEpisode: {
    type: 'object',
    description: 'Information about the next upcoming episode',
    properties: {
      seasonNumber: { type: 'integer', description: 'Season number' },
      episodeNumber: { type: 'integer', description: 'Episode number' },
      title: { type: 'string', description: 'Episode title' },
      airDate: { type: 'string', format: 'date', description: 'Air date (YYYY-MM-DD)' },
      source: { type: 'string', enum: ['emby', 'tmdb'], description: 'Where the air date came from' },
    },
    example: {
      seasonNumber: 2,
      episodeNumber: 5,
      title: 'The Next Episode',
      airDate: '2024-02-15',
      source: 'tmdb',
    },
  },

  // Watching series item
  WatchingSeries: {
    type: 'object',
    description: 'A series in the watching list with upcoming episode info',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Watching entry ID' },
      seriesId: { type: 'string', format: 'uuid', description: 'Series ID' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true, description: 'First air year' },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      overview: { type: 'string', nullable: true },
      communityRating: { type: 'number', nullable: true },
      network: { type: 'string', nullable: true },
      status: { type: 'string', nullable: true, description: 'Series status (Continuing, Ended)' },
      totalSeasons: { type: 'integer', nullable: true },
      totalEpisodes: { type: 'integer', nullable: true },
      addedAt: { type: 'string', format: 'date-time', description: 'When added to watching list' },
      upcomingEpisode: { $ref: 'UpcomingEpisode#' },
    },
  },

  // Watching list response
  WatchingListResponse: {
    type: 'object',
    description: 'List of series being watched',
    properties: {
      series: { type: 'array', items: { $ref: 'WatchingSeries#' } },
      total: { type: 'integer', description: 'Total number of series being watched' },
    },
  },
} as const

// Route-specific schemas
export const getWatchingSchema = {
  tags: ['watching'],
  summary: 'Get watching list',
  description: 'Get the user\'s "Shows You Watch" list with upcoming episode information. Series are sorted by upcoming air dates.',
}

export const getWatchingIdsSchema = {
  tags: ['watching'],
  summary: 'Get watching series IDs',
  description: 'Get just the series IDs the user is watching. Useful for quick UI checks without fetching full details.',
}

export const addToWatchingSchema = {
  tags: ['watching'],
  summary: 'Add to watching',
  description: 'Add a series to the user\'s "Shows You Watch" list. The virtual library in the media server will be updated.',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid', description: 'Series ID to add' },
    },
  },
}

export const removeFromWatchingSchema = {
  tags: ['watching'],
  summary: 'Remove from watching',
  description: 'Remove a series from the user\'s "Shows You Watch" list.',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid', description: 'Series ID to remove' },
    },
  },
}

export const refreshWatchingSchema = {
  tags: ['watching'],
  summary: 'Refresh watching library',
  description: 'Regenerate the user\'s "Shows You Watch" virtual library in the media server. Use this if the library gets out of sync.',
}

export const checkWatchingSchema = {
  tags: ['watching'],
  summary: 'Check if watching',
  description: 'Check if a specific series is in the user\'s watching list.',
  params: {
    type: 'object',
    required: ['seriesId'],
    properties: {
      seriesId: { type: 'string', format: 'uuid', description: 'Series ID to check' },
    },
  },
}
