/**
 * Top Picks OpenAPI Schemas
 */

export const topPicksSchemas = {
  // Popular movie
  PopularMovie: {
    type: 'object',
    properties: {
      movieId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      communityRating: { type: 'number', nullable: true },
      uniqueViewers: { type: 'integer' },
      playCount: { type: 'integer' },
      popularityScore: { type: 'number' },
      rank: { type: 'integer' },
    },
  },

  // Popular series
  PopularSeries: {
    type: 'object',
    properties: {
      seriesId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      communityRating: { type: 'number', nullable: true },
      network: { type: 'string', nullable: true },
      uniqueViewers: { type: 'integer' },
      totalEpisodesWatched: { type: 'integer' },
      avgCompletionRate: { type: 'number' },
      popularityScore: { type: 'number' },
      rank: { type: 'integer' },
    },
  },

  // Top picks config
  TopPicksConfig: {
    type: 'object',
    properties: {
      moviesTimeWindowDays: { type: 'integer' },
      moviesMinUniqueViewers: { type: 'integer' },
      moviesCount: { type: 'integer' },
      seriesTimeWindowDays: { type: 'integer' },
      seriesMinUniqueViewers: { type: 'integer' },
      seriesCount: { type: 'integer' },
      lastRefreshedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
} as const

// Route-specific schemas
export const getTopMoviesSchema = {
  tags: ['top-picks'],
  summary: 'Get top movies',
  description: 'Get globally popular movies based on watch history across all users',
}

export const getTopSeriesSchema = {
  tags: ['top-picks'],
  summary: 'Get top series',
  description: 'Get globally popular TV series based on watch history across all users',
}
