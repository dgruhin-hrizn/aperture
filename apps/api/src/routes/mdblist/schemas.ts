/**
 * MDBList OpenAPI Schemas
 */

export const mdblistSchemas = {
  // MDBList config
  MDBListConfig: {
    type: 'object',
    properties: {
      configured: { type: 'boolean' },
      enabled: { type: 'boolean' },
      hasApiKey: { type: 'boolean' },
      apiKeyPreview: { type: 'string', nullable: true },
      supporterTier: { type: 'boolean' },
    },
  },

  // MDBList list info
  MDBListInfo: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string', nullable: true },
      mediatype: { type: 'string', enum: ['movie', 'show'] },
      items: { type: 'integer' },
      likes: { type: 'integer' },
      user_id: { type: 'integer' },
      user_name: { type: 'string' },
      dynamic: { type: 'boolean' },
    },
  },

  // MDBList item
  MDBListItem: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      imdbid: { type: 'string', nullable: true },
      tmdbid: { type: 'integer', nullable: true },
      tvdbid: { type: 'integer', nullable: true },
      mediatype: { type: 'string', enum: ['movie', 'show'] },
      score: { type: 'number', nullable: true },
      rank: { type: 'integer', nullable: true },
    },
  },

  // Library match result
  MDBListLibraryMatch: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      matched: { type: 'integer' },
      missing: {
        type: 'array',
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
  },

  // Sort option
  MDBListSortOption: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      label: { type: 'string' },
    },
  },

  // Test connection result
  MDBListTestResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      userId: { type: 'integer' },
      username: { type: 'string' },
      patronStatus: { type: 'string' },
      apiRequests: { type: 'integer' },
      apiRequestsCount: { type: 'integer' },
      error: { type: 'string' },
    },
  },
} as const

// Route-specific schemas
export const getMDBListConfigSchema = {
  tags: ['mdblist'],
  summary: 'Get MDBList configuration',
  description: 'Get MDBList configuration (admin only)',
}

export const updateMDBListConfigSchema = {
  tags: ['mdblist'],
  summary: 'Update MDBList configuration',
  description: 'Update MDBList configuration (admin only)',
  body: {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
      enabled: { type: 'boolean' },
      supporterTier: { type: 'boolean' },
    },
  },
}

export const testMDBListSchema = {
  tags: ['mdblist'],
  summary: 'Test MDBList connection',
  description: 'Test MDBList API connection (admin only)',
  body: {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
    },
  },
}

export const getTopListsSchema = {
  tags: ['mdblist'],
  summary: 'Get popular lists',
  description: 'Get popular public lists (admin only)',
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'] },
      limit: { type: 'string' },
    },
  },
}

export const getMyListsSchema = {
  tags: ['mdblist'],
  summary: 'Get my lists',
  description: 'Get user\'s own MDBList lists (admin only)',
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'] },
    },
  },
}

export const searchListsSchema = {
  tags: ['mdblist'],
  summary: 'Search lists',
  description: 'Search public lists (admin only)',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string' },
      mediatype: { type: 'string', enum: ['movie', 'show'] },
    },
  },
}

export const getListInfoSchema = {
  tags: ['mdblist'],
  summary: 'Get list info',
  description: 'Get list details by ID (admin only)',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
}

export const getListCountsSchema = {
  tags: ['mdblist'],
  summary: 'Get list item counts',
  description: 'Get item counts for a list without fetching all items',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
}

export const getListItemsSchema = {
  tags: ['mdblist'],
  summary: 'Get list items',
  description: 'Get items from a list (admin only)',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string' },
      offset: { type: 'string' },
    },
  },
}

export const getLibraryMatchSchema = {
  tags: ['mdblist'],
  summary: 'Match list against library',
  description: 'Get list items matched against local library',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      mediatype: { type: 'string', enum: ['movie', 'show'] },
      sort: { type: 'string' },
    },
  },
}

export const getSortOptionsSchema = {
  tags: ['mdblist'],
  summary: 'Get sort options',
  description: 'Get available sort options for MDBList items',
}
