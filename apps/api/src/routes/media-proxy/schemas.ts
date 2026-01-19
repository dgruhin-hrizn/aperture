/**
 * Media Proxy OpenAPI Schemas
 */

export const mediaProxySchemas = {
  // Proxy error
  ProxyError: {
    type: 'object',
    properties: {
      error: { type: 'string' },
    },
  },
} as const

// Route-specific schemas
export const getImageSchema = {
  tags: ['media'],
  summary: 'Proxy media server image',
  description: 'Proxies image requests to the media server to avoid mixed content issues',
  params: {
    type: 'object',
    required: ['*'],
    properties: {
      '*': { type: 'string', description: 'Image path (e.g., Items/{itemId}/Images/Primary)' },
    },
  },
}
