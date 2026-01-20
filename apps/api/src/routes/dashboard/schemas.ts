/**
 * Dashboard OpenAPI Schemas
 */

export const dashboardSchemas = {
  // Stats object schema
  DashboardStats: {
    type: 'object',
    properties: {
      moviesWatched: { type: 'integer', description: 'Number of unique movies watched' },
      seriesWatched: { type: 'integer', description: 'Number of unique series watched' },
      ratingsCount: { type: 'integer', description: 'Total number of ratings given' },
      watchTimeMinutes: { type: 'integer', description: 'Total watch time in minutes' },
    },
  },

  // Recommendation item schema
  DashboardRecommendation: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      matchScore: { type: 'integer', nullable: true, description: 'Match score as percentage' },
    },
  },

  // Top pick item schema
  DashboardTopPick: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      rank: { type: 'integer', description: 'Popularity rank' },
      popularityScore: { type: 'number', description: 'Calculated popularity score' },
    },
  },

  // Recent watch item schema
  DashboardRecentWatch: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      lastWatched: { type: 'string', format: 'date-time' },
      playCount: { type: 'integer' },
      lastEpisode: {
        type: 'object',
        nullable: true,
        properties: {
          seasonNumber: { type: 'integer' },
          episodeNumber: { type: 'integer' },
        },
      },
    },
  },

  // Recent rating item schema
  DashboardRecentRating: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      rating: { type: 'integer', minimum: 1, maximum: 10 },
      ratedAt: { type: 'string', format: 'date-time' },
    },
  },

  // Main dashboard response
  DashboardResponse: {
    type: 'object',
    properties: {
      stats: { $ref: 'DashboardStats#' },
      recommendations: { type: 'array', items: { $ref: 'DashboardRecommendation#' } },
      topPicks: { type: 'array', items: { $ref: 'DashboardTopPick#' } },
      recentWatches: { type: 'array', items: { $ref: 'DashboardRecentWatch#' } },
      recentRatings: { type: 'array', items: { $ref: 'DashboardRecentRating#' } },
    },
  },
} as const

// Route-specific schemas
export const getDashboardSchema = {
  tags: ['dashboard'],
  summary: 'Get dashboard data',
  description: 'Get aggregated dashboard data for the current user including stats, recommendations, top picks, recent watches, and recent ratings',
}
