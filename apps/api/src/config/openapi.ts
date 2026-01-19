/**
 * OpenAPI/Swagger Configuration
 * 
 * Organized by concern for maintainability.
 */

import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger'
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui'

// =============================================================================
// API Information
// =============================================================================

const API_VERSION = '0.5.8'

const apiInfo = {
  title: 'Aperture API',
  description: `
AI-powered media recommendation engine for Emby and Jellyfin.

## Authentication

Use API keys for programmatic access. Create and manage keys in **Settings > System > API Keys**.

Include your API key in the \`X-API-Key\` header:

\`\`\`
curl -H "X-API-Key: apt_your_key_here" https://your-server/api/movies
\`\`\`

## Rate Limits

There are currently no rate limits, but please be respectful of server resources.

## Errors

All errors return JSON with an \`error\` field:

\`\`\`json
{
  "error": "Description of what went wrong"
}
\`\`\`
`.trim(),
  version: API_VERSION,
  contact: {
    name: 'Aperture',
    url: 'https://github.com/aperture-media/aperture',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
}

// =============================================================================
// External Documentation
// =============================================================================

const externalDocs = {
  url: 'https://github.com/aperture-media/aperture/tree/main/docs',
  description: 'Full Documentation',
}

// =============================================================================
// Tags (organized by domain)
// =============================================================================

const tags = [
  // Core functionality
  { name: 'health', description: 'Health check and monitoring endpoints' },
  { name: 'auth', description: 'Authentication endpoints' },
  { name: 'setup', description: 'Initial setup and configuration wizard' },
  
  // API management
  { name: 'api-keys', description: 'API key creation and management' },
  { name: 'api-errors', description: 'Error tracking and diagnostics' },
  
  // Media browsing
  { name: 'movies', description: 'Movie library and metadata' },
  { name: 'series', description: 'TV series library and metadata' },
  { name: 'search', description: 'Search across all content' },
  { name: 'media', description: 'Media files and proxy endpoints' },
  
  // AI features
  { name: 'recommendations', description: 'AI-powered personalized recommendations' },
  { name: 'ai-assistant', description: 'AI chat assistant for media discovery' },
  { name: 'discovery', description: 'Content discovery and suggestions' },
  { name: 'similarity', description: 'Similar content and graph exploration' },
  { name: 'top-picks', description: 'Top rated and trending content' },
  
  // User management
  { name: 'users', description: 'User accounts and profiles' },
  { name: 'dashboard', description: 'User dashboard and statistics' },
  { name: 'watching', description: 'Currently watching and progress tracking' },
  { name: 'ratings', description: 'User ratings and reviews' },
  
  // Playlists & collections
  { name: 'playlists', description: 'Playlist management' },
  { name: 'channels', description: 'Channel management' },
  
  // Administration
  { name: 'admin', description: 'Administrative functions' },
  { name: 'jobs', description: 'Background job management and scheduling' },
  { name: 'settings', description: 'System configuration and settings' },
  { name: 'backup', description: 'Database backup and restore' },
  
  // Integrations
  { name: 'trakt', description: 'Trakt.tv integration' },
  { name: 'jellyseerr', description: 'Jellyseerr/Overseerr integration' },
  { name: 'mdblist', description: 'MDBList integration' },
]

// =============================================================================
// Security Schemes
// =============================================================================

const securitySchemes = {
  apiKeyAuth: {
    type: 'apiKey' as const,
    in: 'header' as const,
    name: 'X-API-Key',
    description: 'API key for authentication. Create keys in Settings > System > API Keys.',
  },
}

// =============================================================================
// Common Response Schemas
// =============================================================================

const commonSchemas = {
  Error: {
    type: 'object' as const,
    properties: {
      error: { type: 'string' as const, description: 'Error message' },
    },
    required: ['error'],
  },
  Success: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      message: { type: 'string' as const },
    },
  },
  Pagination: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, description: 'Current page number' },
      pageSize: { type: 'integer' as const, description: 'Items per page' },
      total: { type: 'integer' as const, description: 'Total number of items' },
    },
  },
}

// =============================================================================
// Swagger Configuration Export
// =============================================================================

export function getSwaggerConfig(appBaseUrl: string): FastifyDynamicSwaggerOptions {
  return {
    openapi: {
      info: apiInfo,
      externalDocs,
      servers: [
        {
          url: appBaseUrl || 'http://localhost:3456',
          description: 'Aperture Server',
        },
      ],
      tags,
      components: {
        securitySchemes,
        schemas: commonSchemas,
      },
      security: [{ apiKeyAuth: [] }],
    },
  }
}

// =============================================================================
// Swagger UI Configuration Export
// =============================================================================

export const swaggerUIConfig: FastifySwaggerUiOptions = {
  routePrefix: '/openapi',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
    tryItOutEnabled: true,
  },
  uiHooks: {
    onRequest: function (_request, _reply, next) {
      next()
    },
    preHandler: function (_request, _reply, next) {
      next()
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject) => {
    return swaggerObject
  },
  transformSpecificationClone: true,
}
