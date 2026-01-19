/**
 * Graph Playlists OpenAPI Schemas
 */

export const graphPlaylistsSchemas = {
  // Graph playlist
  GraphPlaylist: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      ownerId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      itemCount: { type: 'integer' },
      sourceItemId: { type: 'string', format: 'uuid', nullable: true },
      sourceItemType: { type: 'string', enum: ['movie', 'series'], nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // Playlist item
  PlaylistItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
    },
  },

  // Create playlist request
  CreatePlaylistRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      movieIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      seriesIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      sourceItemId: { type: 'string', format: 'uuid' },
      sourceItemType: { type: 'string', enum: ['movie', 'series'] },
    },
  },

  // AI name/description request
  AiGenerateRequest: {
    type: 'object',
    properties: {
      movieIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      seriesIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      name: { type: 'string', description: 'Existing name (for description generation)' },
    },
  },
} as const

// Route-specific schemas
export const generateAiNameSchema = {
  tags: ['playlists'],
  summary: 'Generate AI playlist name',
  description: 'Generate an AI-powered name for a graph playlist',
}

export const generateAiDescriptionSchema = {
  tags: ['playlists'],
  summary: 'Generate AI playlist description',
  description: 'Generate an AI-powered description for a graph playlist',
}

export const createPlaylistSchema = {
  tags: ['playlists'],
  summary: 'Create graph playlist',
  description: 'Create a new graph playlist',
}

export const getPlaylistsSchema = {
  tags: ['playlists'],
  summary: 'Get playlists',
  description: 'Get all graph playlists for the current user',
}

export const getPlaylistSchema = {
  tags: ['playlists'],
  summary: 'Get playlist',
  description: 'Get a single graph playlist',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const getPlaylistItemsSchema = {
  tags: ['playlists'],
  summary: 'Get playlist items',
  description: 'Get items in a graph playlist',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const deletePlaylistSchema = {
  tags: ['playlists'],
  summary: 'Delete playlist',
  description: 'Delete a graph playlist',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}
