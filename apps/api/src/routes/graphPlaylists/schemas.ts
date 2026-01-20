/**
 * Graph Playlists OpenAPI Schemas
 * 
 * Playlists created from the similarity graph visualization.
 * Users can save selections from the graph as playlists.
 */

export const graphPlaylistsSchemas = {
  // Graph playlist
  GraphPlaylist: {
    type: 'object',
    description: 'A playlist created from the similarity graph',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Playlist ID' },
      ownerId: { type: 'string', format: 'uuid', description: 'User who created the playlist' },
      name: { type: 'string', description: 'Playlist name' },
      description: { type: 'string', nullable: true, description: 'Playlist description' },
      itemCount: { type: 'integer', description: 'Number of items in playlist' },
      sourceItemId: { type: 'string', format: 'uuid', nullable: true, description: 'The item used as source for the graph' },
      sourceItemType: { type: 'string', enum: ['movie', 'series'], nullable: true, description: 'Type of source item' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // Playlist item
  PlaylistItem: {
    type: 'object',
    description: 'An item in a playlist',
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
    description: 'Request to create a new playlist',
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'Playlist name', minLength: 1, maxLength: 255 },
      description: { type: 'string', description: 'Optional description' },
      movieIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Movie IDs to include' },
      seriesIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Series IDs to include' },
      sourceItemId: { type: 'string', format: 'uuid', description: 'Source item from graph' },
      sourceItemType: { type: 'string', enum: ['movie', 'series'], description: 'Type of source item' },
    },
    example: {
      name: 'Mind-Bending Sci-Fi',
      description: 'Movies similar to Inception',
      movieIds: ['123e4567-e89b-12d3-a456-426614174000'],
      sourceItemId: '456e7890-e89b-12d3-a456-426614174001',
      sourceItemType: 'movie',
    },
  },

  // AI name/description request
  AiGenerateRequest: {
    type: 'object',
    description: 'Request for AI-generated name or description',
    properties: {
      movieIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Movies in the playlist' },
      seriesIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Series in the playlist' },
      name: { type: 'string', description: 'Existing name (for description generation)' },
    },
  },
} as const

// Route-specific schemas
export const generateAiNameSchema = {
  tags: ['playlists'],
  summary: 'Generate AI playlist name',
  description: 'Generate an AI-powered name for a playlist based on its contents. Requires text generation to be configured.',
  body: { $ref: 'AiGenerateRequest#' },
}

export const generateAiDescriptionSchema = {
  tags: ['playlists'],
  summary: 'Generate AI playlist description',
  description: 'Generate an AI-powered description for a playlist based on its contents and name.',
  body: { $ref: 'AiGenerateRequest#' },
}

export const createPlaylistSchema = {
  tags: ['playlists'],
  summary: 'Create graph playlist',
  description: 'Create a new playlist from selected graph items.',
  body: { $ref: 'CreatePlaylistRequest#' },
}

export const getPlaylistsSchema = {
  tags: ['playlists'],
  summary: 'Get playlists',
  description: 'Get all graph playlists for the current user.',
}

export const getPlaylistSchema = {
  tags: ['playlists'],
  summary: 'Get playlist',
  description: 'Get a single graph playlist by ID.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Playlist ID' },
    },
  },
}

export const getPlaylistItemsSchema = {
  tags: ['playlists'],
  summary: 'Get playlist items',
  description: 'Get all items in a graph playlist.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Playlist ID' },
    },
  },
}

export const deletePlaylistSchema = {
  tags: ['playlists'],
  summary: 'Delete playlist',
  description: 'Delete a graph playlist. Only the owner can delete their playlists.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Playlist ID to delete' },
    },
  },
}
