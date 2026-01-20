/**
 * Top Picks OpenAPI Schemas
 * 
 * "Top Picks" feature showing globally popular content based on
 * watch history across all users.
 */

export const topPicksSchemas = {
  // Popular movie
  PopularMovie: {
    type: 'object',
    description: 'A popular movie based on watch statistics',
    properties: {
      movieId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      communityRating: { type: 'number', nullable: true },
      uniqueViewers: { type: 'integer', description: 'Number of unique users who watched' },
      playCount: { type: 'integer', description: 'Total play count across all users' },
      popularityScore: { type: 'number', description: 'Calculated popularity score (0-100)' },
      rank: { type: 'integer', description: 'Position in the top picks list' },
    },
    example: {
      movieId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Oppenheimer',
      year: 2023,
      uniqueViewers: 45,
      playCount: 52,
      popularityScore: 95.5,
      rank: 1,
    },
  },

  // Popular series
  PopularSeries: {
    type: 'object',
    description: 'A popular series based on watch statistics',
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
      uniqueViewers: { type: 'integer', description: 'Number of unique users who watched' },
      totalEpisodesWatched: { type: 'integer', description: 'Total episodes watched across all users' },
      avgCompletionRate: { type: 'number', description: 'Average completion rate (0-1)' },
      popularityScore: { type: 'number', description: 'Calculated popularity score (0-100)' },
      rank: { type: 'integer', description: 'Position in the top picks list' },
    },
  },

  // Top picks config
  TopPicksConfig: {
    type: 'object',
    description: 'Top Picks configuration settings',
    properties: {
      moviesTimeWindowDays: { type: 'integer', description: 'Time window for movie popularity calculation' },
      moviesMinUniqueViewers: { type: 'integer', description: 'Minimum viewers required for movies' },
      moviesCount: { type: 'integer', description: 'Number of top movies to show' },
      seriesTimeWindowDays: { type: 'integer', description: 'Time window for series popularity calculation' },
      seriesMinUniqueViewers: { type: 'integer', description: 'Minimum viewers required for series' },
      seriesCount: { type: 'integer', description: 'Number of top series to show' },
      lastRefreshedAt: { type: 'string', format: 'date-time', nullable: true, description: 'When top picks were last calculated' },
    },
  },
} as const

// Route-specific schemas
export const getTopMoviesSchema = {
  tags: ['top-picks'],
  summary: 'Get top movies',
  description: 'Get globally popular movies based on watch history across all users. Results are cached and refreshed periodically.',
}

export const getTopSeriesSchema = {
  tags: ['top-picks'],
  summary: 'Get top series',
  description: 'Get globally popular TV series based on watch history across all users. Results are cached and refreshed periodically.',
}
