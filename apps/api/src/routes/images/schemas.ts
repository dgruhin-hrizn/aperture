/**
 * Images OpenAPI Schemas
 */

// =============================================================================
// Image Retrieval Schemas
// =============================================================================

export const getImage = {
  tags: ['images'],
  summary: 'Get image info',
  description: 'Get image information for an entity.',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const getAllImages = {
  tags: ['images'],
  summary: 'Get all images',
  description: 'Get all images for an entity.',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
}

// =============================================================================
// Image Upload Schemas
// =============================================================================

export const uploadImage = {
  tags: ['images'],
  summary: 'Upload image',
  description: 'Upload a new user image for an entity.',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const deleteImage = {
  tags: ['images'],
  summary: 'Delete user image',
  description: 'Delete user\'s custom image (reverts to default).',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

// =============================================================================
// Admin Image Schemas
// =============================================================================

export const setDefaultImage = {
  tags: ['images'],
  summary: 'Set default image (admin)',
  description: 'Set default image for an entity (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const deleteDefaultImage = {
  tags: ['images'],
  summary: 'Delete default image (admin)',
  description: 'Delete default image (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const importFromEmby = {
  tags: ['images'],
  summary: 'Import from media server (admin)',
  description: 'Import image from media server (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const embyCheck = {
  tags: ['images'],
  summary: 'Check media server image',
  description: 'Check if media server has an image for an entity.',
  params: {
    type: 'object' as const,
    properties: {
      entityType: { type: 'string' as const, enum: ['library', 'collection', 'playlist'] },
      entityId: { type: 'string' as const },
    },
    required: ['entityType', 'entityId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      imageType: { type: 'string' as const, enum: ['Primary', 'Backdrop', 'Banner'] },
    },
  },
}

export const getDimensions = {
  tags: ['images'],
  summary: 'Get recommended dimensions',
  description: 'Get recommended image dimensions for entity types.',
}

// Export all schemas
export const imageSchemas = {
  getImage,
  getAllImages,
  uploadImage,
  deleteImage,
  setDefaultImage,
  deleteDefaultImage,
  importFromEmby,
  embyCheck,
  getDimensions,
}
