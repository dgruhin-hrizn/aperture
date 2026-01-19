/**
 * MDBList OpenAPI Schemas
 * 
 * Integration with MDBList.com for curated movie/TV lists.
 * All endpoints require admin privileges.
 */

export const mdblistSchemas = {
  // MDBList config
  MDBListConfig: {
    type: 'object',
    description: 'MDBList integration configuration',
    properties: {
      configured: { type: 'boolean', description: 'Whether MDBList is configured' },
      enabled: { type: 'boolean', description: 'Whether MDBList integration is enabled' },
      hasApiKey: { type: 'boolean', description: 'Whether API key is set' },
      apiKeyPreview: { type: 'string', nullable: true, description: 'Masked API key preview' },
      supporterTier: { type: 'boolean', description: 'Whether user has supporter tier (higher rate limits)' },
    },
    example: {
      configured: true,
      enabled: true,
      hasApiKey: true,
      apiKeyPreview: 'abc1...xyz9',
      supporterTier: false,
    },
  },

  // MDBList list info
  MDBListInfo: {
    type: 'object',
    description: 'Information about an MDBList list',
    properties: {
      id: { type: 'integer', description: 'MDBList list ID' },
      name: { type: 'string', description: 'List name' },
      slug: { type: 'string', description: 'URL-friendly slug' },
      description: { type: 'string', nullable: true, description: 'List description' },
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Type of content in list' },
      items: { type: 'integer', description: 'Number of items in list' },
      likes: { type: 'integer', description: 'Number of likes' },
      user_id: { type: 'integer', description: 'Creator user ID' },
      user_name: { type: 'string', description: 'Creator username' },
      dynamic: { type: 'boolean', description: 'Whether list is dynamically updated' },
    },
    example: {
      id: 12345,
      name: 'Top 250 Movies',
      slug: 'top-250-movies',
      description: 'The best movies of all time',
      mediatype: 'movie',
      items: 250,
      likes: 1500,
      user_id: 1,
      user_name: 'mdblist',
      dynamic: true,
    },
  },

  // MDBList item
  MDBListItem: {
    type: 'object',
    description: 'A single item from an MDBList list',
    properties: {
      id: { type: 'integer', description: 'Item ID' },
      title: { type: 'string', description: 'Title' },
      year: { type: 'integer', nullable: true, description: 'Release year' },
      imdbid: { type: 'string', nullable: true, description: 'IMDb ID', example: 'tt0111161' },
      tmdbid: { type: 'integer', nullable: true, description: 'TMDb ID' },
      tvdbid: { type: 'integer', nullable: true, description: 'TVDB ID (for TV shows)' },
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Media type' },
      score: { type: 'number', nullable: true, description: 'MDBList score' },
      rank: { type: 'integer', nullable: true, description: 'Position in list' },
    },
    example: {
      id: 1,
      title: 'The Shawshank Redemption',
      year: 1994,
      imdbid: 'tt0111161',
      tmdbid: 278,
      mediatype: 'movie',
      score: 9.3,
      rank: 1,
    },
  },

  // Library match result
  MDBListLibraryMatch: {
    type: 'object',
    description: 'Result of matching MDBList items against local library',
    properties: {
      total: { type: 'integer', description: 'Total items in list' },
      matched: { type: 'integer', description: 'Items found in local library' },
      missing: {
        type: 'array',
        description: 'Items not in local library',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            year: { type: 'integer', nullable: true },
            tmdbid: { type: 'integer' },
            imdbid: { type: 'string' },
            mediatype: { type: 'string' },
          },
        },
      },
    },
    example: {
      total: 250,
      matched: 180,
      missing: [
        { title: 'Some Movie', year: 2023, tmdbid: 12345, imdbid: 'tt1234567', mediatype: 'movie' },
      ],
    },
  },

  // Sort option
  MDBListSortOption: {
    type: 'object',
    description: 'Available sort option for list items',
    properties: {
      value: { type: 'string', description: 'Sort value to use in API calls' },
      label: { type: 'string', description: 'Human-readable label' },
    },
    example: {
      value: 'rank',
      label: 'Rank',
    },
  },

  // Test connection result
  MDBListTestResult: {
    type: 'object',
    description: 'Result of MDBList API connection test',
    properties: {
      success: { type: 'boolean' },
      userId: { type: 'integer', nullable: true, description: 'MDBList user ID' },
      username: { type: 'string', nullable: true, description: 'MDBList username' },
      patronStatus: { type: 'string', nullable: true, description: 'Patron/supporter status' },
      apiRequests: { type: 'integer', nullable: true, description: 'API requests remaining' },
      apiRequestsCount: { type: 'integer', nullable: true, description: 'Total API requests allowed' },
      error: { type: 'string', nullable: true, description: 'Error message if failed' },
    },
    example: {
      success: true,
      userId: 12345,
      username: 'moviefan',
      patronStatus: 'none',
      apiRequests: 950,
      apiRequestsCount: 1000,
    },
  },
} as const

// Route-specific schemas
export const getMDBListConfigSchema = {
  tags: ['mdblist'],
  summary: 'Get MDBList configuration',
  description: 'Get MDBList integration configuration (admin only). API key is masked.',
  response: {
    200: { $ref: 'MDBListConfig#' },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}

export const updateMDBListConfigSchema = {
  tags: ['mdblist'],
  summary: 'Update MDBList configuration',
  description: 'Update MDBList API settings (admin only). Get API key from https://mdblist.com/preferences/',
  body: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'MDBList API key from your account settings' },
      enabled: { type: 'boolean', description: 'Enable/disable integration' },
      supporterTier: { type: 'boolean', description: 'Mark as supporter tier for higher rate limits' },
    },
    example: {
      apiKey: 'your-api-key',
      enabled: true,
      supporterTier: false,
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
}

export const testMDBListSchema = {
  tags: ['mdblist'],
  summary: 'Test MDBList connection',
  description: 'Test MDBList API connection and get account info (admin only).',
  body: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'API key to test (optional, uses saved if not provided)' },
    },
  },
  response: {
    200: { $ref: 'MDBListTestResult#' },
  },
}

export const getTopListsSchema = {
  tags: ['mdblist'],
  summary: 'Get popular lists',
  description: 'Get popular public lists from MDBList (admin only). Useful for discovering curated content.',
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Filter by media type' },
      limit: { type: 'string', description: 'Maximum lists to return', default: '20', example: '50' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        lists: { type: 'array', items: { $ref: 'MDBListInfo#' } },
      },
    },
  },
}

export const getMyListsSchema = {
  tags: ['mdblist'],
  summary: 'Get my lists',
  description: 'Get your own MDBList lists (admin only). Requires API key to be configured.',
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Filter by media type' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        lists: { type: 'array', items: { $ref: 'MDBListInfo#' } },
      },
    },
  },
}

export const searchListsSchema = {
  tags: ['mdblist'],
  summary: 'Search lists',
  description: 'Search public MDBList lists by name (admin only).',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query', minLength: 2, example: 'horror' },
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Filter by media type' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        lists: { type: 'array', items: { $ref: 'MDBListInfo#' } },
      },
    },
  },
}

export const getListInfoSchema = {
  tags: ['mdblist'],
  summary: 'Get list info',
  description: 'Get detailed information about a specific MDBList list (admin only).',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'MDBList list ID', example: '12345' },
    },
  },
  response: {
    200: { $ref: 'MDBListInfo#' },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'List not found' },
      },
    },
  },
}

export const getListCountsSchema = {
  tags: ['mdblist'],
  summary: 'Get list item counts',
  description: 'Get item counts for a list without fetching all items. Useful for UI display.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'MDBList list ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        total: { type: 'integer', description: 'Total items in list' },
        movies: { type: 'integer', description: 'Number of movies' },
        shows: { type: 'integer', description: 'Number of TV shows' },
      },
    },
  },
}

export const getListItemsSchema = {
  tags: ['mdblist'],
  summary: 'Get list items',
  description: 'Get items from an MDBList list with pagination (admin only).',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'MDBList list ID' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum items to return', default: '100', example: '50' },
      offset: { type: 'string', description: 'Number of items to skip', default: '0', example: '100' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: 'MDBListItem#' } },
        total: { type: 'integer', description: 'Total items in list' },
        hasMore: { type: 'boolean', description: 'Whether more items exist' },
      },
    },
  },
}

export const getLibraryMatchSchema = {
  tags: ['mdblist'],
  summary: 'Match list against library',
  description: 'Compare MDBList items against your local library to find what\'s missing (admin only).',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'MDBList list ID' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'], description: 'Filter by media type' },
      sort: { type: 'string', description: 'Sort order for missing items', example: 'rank' },
    },
  },
  response: {
    200: { $ref: 'MDBListLibraryMatch#' },
  },
}

export const getSortOptionsSchema = {
  tags: ['mdblist'],
  summary: 'Get sort options',
  description: 'Get available sort options for MDBList items.',
  response: {
    200: {
      type: 'object',
      properties: {
        options: { type: 'array', items: { $ref: 'MDBListSortOption#' } },
      },
      example: {
        options: [
          { value: 'rank', label: 'Rank' },
          { value: 'title', label: 'Title' },
          { value: 'year', label: 'Year' },
          { value: 'score', label: 'Score' },
        ],
      },
    },
  },
}
