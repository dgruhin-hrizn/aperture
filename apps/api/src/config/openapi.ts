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

const API_VERSION = '0.6.0'

const apiInfo = {
  title: 'Aperture API',
  description: `
AI-powered media recommendation engine for Emby and Jellyfin.

## Authentication

Use API keys for programmatic access to the Aperture API.

### Creating an API Key

1. Log in to Aperture as an **admin user**
2. Go to **Admin → Settings** (or navigate to \`/admin/settings\`)
3. Click the **System** tab (last tab on the right)
4. In the **API Keys** section at the top, click **Create API Key**
5. Give your key a name, select an expiration (or never), and click **Create**
6. **Copy the key immediately** — it will only be shown once!

> **Note:** API keys are only shown once when created. Store them securely!

### Using Your API Key

Include your API key in the \`X-API-Key\` header with every request:

\`\`\`bash
curl -H "X-API-Key: apt_your_key_here" https://your-server/api/movies
\`\`\`

All API keys are prefixed with \`apt_\` for easy identification.

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
    url: 'https://github.com/dgruhin-hrizn/aperture',
  },
  license: {
    name: 'AGPL-3.0',
    url: 'https://www.gnu.org/licenses/agpl-3.0.html',
  },
}

// =============================================================================
// External Documentation
// =============================================================================

const externalDocs = {
  url: 'https://github.com/dgruhin-hrizn/aperture/tree/main/docs',
  description: 'Full Documentation',
}

// =============================================================================
// Tags (organized by domain)
// =============================================================================

const DOCS_BASE = 'https://github.com/dgruhin-hrizn/aperture/blob/main/docs'

const tags = [
  // === Setup & Authentication (First Priority) ===
  {
    name: 'auth',
    description: 'Authentication via media server credentials. Handles login/logout, session management, and user UI preferences.',
    externalDocs: {
      description: 'Logging In Guide',
      url: `${DOCS_BASE}/features/logging-in.md`,
    },
  },
  {
    name: 'setup',
    description: 'Initial setup wizard for first-time configuration. Guides through media server connection, library selection, and AI provider setup. Admin only.',
    externalDocs: {
      description: 'Setup Wizard Guide',
      url: `${DOCS_BASE}/admin/setup-wizard.md`,
    },
  },
  {
    name: 'settings',
    description: 'System configuration including media server, AI providers, recommendation algorithm tuning, and integration settings. Most endpoints are admin only.',
    externalDocs: {
      description: 'Integrations Overview',
      url: `${DOCS_BASE}/admin/integrations-overview.md`,
    },
  },

  // === Health & Monitoring ===
  {
    name: 'health',
    description: 'Health check and monitoring endpoints. Returns server status, version info, and dependency health.',
  },

  // === User Management ===
  {
    name: 'users',
    description: 'User account management including profiles, permissions, and admin user operations. Admin endpoints require admin privileges.',
    externalDocs: {
      description: 'User Management Guide',
      url: `${DOCS_BASE}/admin/user-management.md`,
    },
  },
  {
    name: 'dashboard',
    description: 'User dashboard data including watch statistics, recent activity, and personalized metrics.',
    externalDocs: {
      description: 'Dashboard Features',
      url: `${DOCS_BASE}/features/dashboard.md`,
    },
  },
  {
    name: 'ratings',
    description: 'User ratings (1-10 scale) for movies and series. Ratings influence recommendation algorithm and can sync with Trakt.',
    externalDocs: {
      description: 'Ratings Guide',
      url: `${DOCS_BASE}/features/ratings.md`,
    },
  },
  {
    name: 'watching',
    description: 'Currently watching content and watch progress tracking. Synced from media server watch history.',
    externalDocs: {
      description: 'Watch History',
      url: `${DOCS_BASE}/features/watch-history.md`,
    },
  },

  // === Media Library ===
  {
    name: 'movies',
    description: 'Movie library browsing, filtering, and metadata. Includes genres, collections/franchises, and enriched data from TMDb/OMDb.',
    externalDocs: {
      description: 'Movie Details',
      url: `${DOCS_BASE}/features/movie-detail.md`,
    },
  },
  {
    name: 'series',
    description: 'TV series library with seasons, episodes, and metadata. Includes enriched data and watch progress per episode.',
    externalDocs: {
      description: 'Series Details',
      url: `${DOCS_BASE}/features/series-detail.md`,
    },
  },
  {
    name: 'search',
    description: 'Global search across movies, series, and people. Supports fuzzy matching and filters.',
    externalDocs: {
      description: 'Global Search',
      url: `${DOCS_BASE}/features/global-search.md`,
    },
  },
  {
    name: 'media',
    description: 'Media file proxying and image endpoints. Proxies requests to Emby/Jellyfin for posters, backdrops, and streaming URLs.',
  },

  // === AI & Recommendations ===
  {
    name: 'recommendations',
    description: 'AI-powered personalized recommendations using semantic similarity. Requires embeddings to be generated. Supports configurable algorithm weights for similarity, novelty, ratings, and diversity.',
    externalDocs: {
      description: 'Recommendations Guide',
      url: `${DOCS_BASE}/features/recommendations.md`,
    },
  },
  {
    name: 'ai-assistant',
    description: 'AI chat assistant for conversational media discovery. Uses configured chat model to answer questions about your library and provide recommendations.',
    externalDocs: {
      description: 'AI Assistant Guide',
      url: `${DOCS_BASE}/features/ai-assistant.md`,
    },
  },
  {
    name: 'discovery',
    description: 'Content discovery features including curated suggestions, genre exploration, and mood-based browsing.',
    externalDocs: {
      description: 'Discovery Features',
      url: `${DOCS_BASE}/features/discovery.md`,
    },
  },
  {
    name: 'similarity',
    description: 'Similar content lookup and interactive similarity graph exploration. Uses AI embeddings to find semantically similar movies/series.',
    externalDocs: {
      description: 'Similarity Graphs',
      url: `${DOCS_BASE}/features/similarity-graphs.md`,
    },
  },
  {
    name: 'top-picks',
    description: 'Curated top picks generated per user based on their taste profile. Refreshed on configurable schedule.',
    externalDocs: {
      description: 'Top Picks Guide',
      url: `${DOCS_BASE}/features/top-picks.md`,
    },
  },

  // === Playlists & Channels ===
  {
    name: 'playlists',
    description: 'User playlist creation and management. Playlists can be synced to media server.',
    externalDocs: {
      description: 'Playlists Guide',
      url: `${DOCS_BASE}/features/playlists.md`,
    },
  },
  {
    name: 'channels',
    description: 'Channel management for organizing content into themed collections.',
  },

  // === Administration ===
  {
    name: 'admin',
    description: 'Administrative functions including system status, database management, and global settings. All endpoints require admin privileges.',
    externalDocs: {
      description: 'Admin Guide',
      url: `${DOCS_BASE}/admin-guide.md`,
    },
  },
  {
    name: 'jobs',
    description: 'Background job management including library sync, enrichment, embedding generation, and recommendation runs. View status, trigger manually, or configure schedules. Admin only.',
    externalDocs: {
      description: 'Jobs Overview',
      url: `${DOCS_BASE}/admin/jobs-overview.md`,
    },
  },
  {
    name: 'backup',
    description: 'Database backup and restore functionality. Create snapshots, download backups, and restore from previous states. Admin only.',
    externalDocs: {
      description: 'Backup & Restore Guide',
      url: `${DOCS_BASE}/admin/backup-restore.md`,
    },
  },
  {
    name: 'api-keys',
    description: 'API key creation and management for programmatic access. Keys are prefixed with `apt_` and can have expiration dates. Admin only.',
  },
  {
    name: 'api-errors',
    description: 'Error tracking and diagnostics. View recent API errors, stack traces, and error patterns for debugging. Admin only.',
    externalDocs: {
      description: 'API Errors Guide',
      url: `${DOCS_BASE}/admin/api-errors.md`,
    },
  },

  // === Integrations ===
  {
    name: 'trakt',
    description: 'Trakt.tv integration for syncing watch history, ratings, and watchlists. Requires Trakt account connection.',
    externalDocs: {
      description: 'Trakt Integration',
      url: `${DOCS_BASE}/features/trakt-integration.md`,
    },
  },
  {
    name: 'jellyseerr',
    description: 'Jellyseerr/Overseerr integration for requesting new content. Shows request status on movie/series pages.',
    externalDocs: {
      description: 'Jellyseerr Setup',
      url: `${DOCS_BASE}/admin/jellyseerr.md`,
    },
  },
  {
    name: 'mdblist',
    description: 'MDBList integration for additional ratings and list imports. Provides Trakt, IMDb, and community list data.',
    externalDocs: {
      description: 'MDBList Setup',
      url: `${DOCS_BASE}/admin/mdblist.md`,
    },
  },
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
// Shared Component Schemas
// =============================================================================

// Export schemas so they can be imported in route files
export const schemas = {
  // ---------------------------------------------------------------------------
  // Common Response Schemas
  // ---------------------------------------------------------------------------
  Error: {
    type: 'object' as const,
    properties: {
      error: { type: 'string' as const, description: 'Error message' },
    },
    required: ['error'] as string[],
    example: {
      error: 'Movie not found',
    },
  },

  Success: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      message: { type: 'string' as const },
    },
    example: {
      success: true,
      message: 'Operation completed successfully',
    },
  },

  Pagination: {
    type: 'object' as const,
    properties: {
      page: { type: 'integer' as const, description: 'Current page number', example: 1 },
      pageSize: { type: 'integer' as const, description: 'Items per page', example: 50 },
      total: { type: 'integer' as const, description: 'Total number of items', example: 1234 },
    },
  },

  // ---------------------------------------------------------------------------
  // Movie Schemas
  // ---------------------------------------------------------------------------
  Movie: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Unique movie identifier' },
      providerItemId: { type: 'string' as const, description: 'ID from Emby/Jellyfin' },
      title: { type: 'string' as const, description: 'Movie title' },
      originalTitle: { type: 'string' as const, nullable: true, description: 'Original language title' },
      year: { type: 'integer' as const, nullable: true, description: 'Release year' },
      genres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genre list' },
      overview: { type: 'string' as const, nullable: true, description: 'Plot summary' },
      communityRating: { type: 'number' as const, nullable: true, description: 'Rating from 0-10' },
      runtimeMinutes: { type: 'integer' as const, nullable: true, description: 'Runtime in minutes' },
      posterUrl: { type: 'string' as const, nullable: true, description: 'Poster image URL' },
      backdropUrl: { type: 'string' as const, nullable: true, description: 'Backdrop image URL' },
      rtCriticScore: { type: 'integer' as const, nullable: true, description: 'Rotten Tomatoes critic score' },
      awardsSummary: { type: 'string' as const, nullable: true, description: 'Awards and nominations' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      providerItemId: '12345',
      title: 'The Matrix',
      originalTitle: null,
      year: 1999,
      genres: ['Action', 'Sci-Fi'],
      overview: 'A computer hacker learns about the true nature of reality.',
      communityRating: 8.7,
      runtimeMinutes: 136,
      posterUrl: '/api/images/movie/123/poster',
      backdropUrl: '/api/images/movie/123/backdrop',
      rtCriticScore: 83,
      awardsSummary: 'Won 4 Oscars',
    },
  },

  MovieDetail: {
    type: 'object' as const,
    description: 'Full movie details including cast, crew, and enrichment data',
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      title: { type: 'string' as const },
      originalTitle: { type: 'string' as const, nullable: true },
      year: { type: 'integer' as const, nullable: true },
      genres: { type: 'array' as const, items: { type: 'string' as const } },
      overview: { type: 'string' as const, nullable: true },
      communityRating: { type: 'number' as const, nullable: true },
      runtimeMinutes: { type: 'integer' as const, nullable: true },
      posterUrl: { type: 'string' as const, nullable: true },
      backdropUrl: { type: 'string' as const, nullable: true },
      // Cast & Crew
      actors: {
        type: 'array' as const,
        nullable: true,
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            role: { type: 'string' as const, nullable: true },
            thumb: { type: 'string' as const, nullable: true },
          },
        },
      },
      directors: { type: 'array' as const, nullable: true, items: { type: 'string' as const } },
      writers: { type: 'array' as const, nullable: true, items: { type: 'string' as const } },
      studios: {
        type: 'array' as const,
        nullable: true,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, nullable: true },
            name: { type: 'string' as const },
          },
        },
      },
      // External IDs
      imdbId: { type: 'string' as const, nullable: true, description: 'IMDb ID (e.g., tt0133093)' },
      tmdbId: { type: 'string' as const, nullable: true, description: 'TMDb ID' },
      // Enrichment scores
      rtCriticScore: { type: 'integer' as const, nullable: true, description: 'Rotten Tomatoes critic score (0-100)' },
      rtAudienceScore: { type: 'integer' as const, nullable: true, description: 'Rotten Tomatoes audience score (0-100)' },
      metacriticScore: { type: 'integer' as const, nullable: true, description: 'Metacritic score (0-100)' },
      letterboxdScore: { type: 'number' as const, nullable: true, description: 'Letterboxd rating (0-5)' },
      // Collections
      collectionId: { type: 'string' as const, nullable: true },
      collectionName: { type: 'string' as const, nullable: true, description: 'Franchise name (e.g., "The Matrix Collection")' },
      // Keywords
      keywords: { type: 'array' as const, nullable: true, items: { type: 'string' as const } },
    },
  },

  SimilarMovie: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      title: { type: 'string' as const },
      year: { type: 'integer' as const, nullable: true },
      posterUrl: { type: 'string' as const, nullable: true },
      genres: { type: 'array' as const, items: { type: 'string' as const } },
      similarity: { type: 'number' as const, description: 'Similarity score from 0-1' },
    },
    example: {
      id: '456e4567-e89b-12d3-a456-426614174001',
      title: 'Inception',
      year: 2010,
      posterUrl: '/api/images/movie/456/poster',
      genres: ['Action', 'Sci-Fi', 'Thriller'],
      similarity: 0.87,
    },
  },

  // ---------------------------------------------------------------------------
  // Series Schemas
  // ---------------------------------------------------------------------------
  Series: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Unique series identifier' },
      providerItemId: { type: 'string' as const, description: 'ID from Emby/Jellyfin' },
      title: { type: 'string' as const, description: 'Series title' },
      originalTitle: { type: 'string' as const, nullable: true },
      year: { type: 'integer' as const, nullable: true, description: 'First air year' },
      endYear: { type: 'integer' as const, nullable: true, description: 'Last air year (null if ongoing)' },
      genres: { type: 'array' as const, items: { type: 'string' as const } },
      overview: { type: 'string' as const, nullable: true },
      communityRating: { type: 'number' as const, nullable: true },
      status: { type: 'string' as const, nullable: true, description: 'Continuing, Ended, etc.' },
      totalSeasons: { type: 'integer' as const, nullable: true },
      totalEpisodes: { type: 'integer' as const, nullable: true },
      network: { type: 'string' as const, nullable: true, description: 'Original network/streaming service' },
      posterUrl: { type: 'string' as const, nullable: true },
      backdropUrl: { type: 'string' as const, nullable: true },
    },
    example: {
      id: '789e4567-e89b-12d3-a456-426614174002',
      providerItemId: '67890',
      title: 'Breaking Bad',
      originalTitle: null,
      year: 2008,
      endYear: 2013,
      genres: ['Drama', 'Crime', 'Thriller'],
      overview: 'A high school chemistry teacher turned methamphetamine manufacturer.',
      communityRating: 9.5,
      status: 'Ended',
      totalSeasons: 5,
      totalEpisodes: 62,
      network: 'AMC',
      posterUrl: '/api/images/series/789/poster',
      backdropUrl: '/api/images/series/789/backdrop',
    },
  },

  Episode: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      seasonNumber: { type: 'integer' as const },
      episodeNumber: { type: 'integer' as const },
      title: { type: 'string' as const },
      overview: { type: 'string' as const, nullable: true },
      premiereDate: { type: 'string' as const, format: 'date', nullable: true },
      runtimeMinutes: { type: 'integer' as const, nullable: true },
      communityRating: { type: 'number' as const, nullable: true },
      posterUrl: { type: 'string' as const, nullable: true },
    },
    example: {
      id: 'abc4567-e89b-12d3-a456-426614174003',
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Pilot',
      overview: 'Walter White, a chemistry teacher, discovers he has cancer.',
      premiereDate: '2008-01-20',
      runtimeMinutes: 58,
      communityRating: 9.0,
      posterUrl: '/api/images/episode/abc/poster',
    },
  },

  // ---------------------------------------------------------------------------
  // User & Auth Schemas
  // ---------------------------------------------------------------------------
  User: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      username: { type: 'string' as const },
      displayName: { type: 'string' as const, nullable: true },
      provider: { type: 'string' as const, enum: ['emby', 'jellyfin'] },
      isAdmin: { type: 'boolean' as const },
      isEnabled: { type: 'boolean' as const },
      avatarUrl: { type: 'string' as const, nullable: true },
    },
    example: {
      id: 'def4567-e89b-12d3-a456-426614174004',
      username: 'john_doe',
      displayName: 'John Doe',
      provider: 'jellyfin',
      isAdmin: false,
      isEnabled: true,
      avatarUrl: '/api/users/def4567/avatar',
    },
  },

  // ---------------------------------------------------------------------------
  // Recommendation Schemas
  // ---------------------------------------------------------------------------
  Recommendation: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Recommendation candidate ID' },
      movieId: { type: 'string' as const, format: 'uuid', nullable: true },
      seriesId: { type: 'string' as const, format: 'uuid', nullable: true },
      rank: { type: 'integer' as const, description: 'Position in recommendation list' },
      isSelected: { type: 'boolean' as const },
      finalScore: { type: 'number' as const, description: 'Combined recommendation score' },
      similarityScore: { type: 'number' as const, nullable: true },
      noveltyScore: { type: 'number' as const, nullable: true },
      ratingScore: { type: 'number' as const, nullable: true },
      diversityScore: { type: 'number' as const, nullable: true },
      movie: { $ref: '#/components/schemas/Movie' },
    },
  },

  RecommendationRun: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      userId: { type: 'string' as const, format: 'uuid' },
      runType: { type: 'string' as const },
      mediaType: { type: 'string' as const, enum: ['movie', 'series'] },
      candidateCount: { type: 'integer' as const },
      selectedCount: { type: 'integer' as const },
      durationMs: { type: 'integer' as const, nullable: true },
      status: { type: 'string' as const, enum: ['running', 'completed', 'failed'] },
      createdAt: { type: 'string' as const, format: 'date-time' },
    },
  },

  // ---------------------------------------------------------------------------
  // Rating Schema
  // ---------------------------------------------------------------------------
  Rating: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
      movieId: { type: 'string' as const, format: 'uuid', nullable: true },
      seriesId: { type: 'string' as const, format: 'uuid', nullable: true },
      rating: { type: 'integer' as const, minimum: 1, maximum: 10, description: 'Rating from 1-10' },
      source: { type: 'string' as const, description: 'Where the rating came from (manual, trakt, etc.)' },
      createdAt: { type: 'string' as const, format: 'date-time' },
      updatedAt: { type: 'string' as const, format: 'date-time' },
      // Joined fields
      title: { type: 'string' as const, nullable: true },
      year: { type: 'integer' as const, nullable: true },
      posterUrl: { type: 'string' as const, nullable: true },
    },
    example: {
      id: 'ghi4567-e89b-12d3-a456-426614174005',
      movieId: '123e4567-e89b-12d3-a456-426614174000',
      seriesId: null,
      rating: 9,
      source: 'manual',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      title: 'The Matrix',
      year: 1999,
      posterUrl: '/api/images/movie/123/poster',
    },
  },

  // ---------------------------------------------------------------------------
  // Search Schemas
  // ---------------------------------------------------------------------------
  SearchResult: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const, enum: ['movie', 'series', 'person'] },
      id: { type: 'string' as const, format: 'uuid' },
      title: { type: 'string' as const },
      year: { type: 'integer' as const, nullable: true },
      posterUrl: { type: 'string' as const, nullable: true },
      overview: { type: 'string' as const, nullable: true },
      genres: { type: 'array' as const, items: { type: 'string' as const }, nullable: true },
    },
    example: {
      type: 'movie',
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'The Matrix',
      year: 1999,
      posterUrl: '/api/images/movie/123/poster',
      overview: 'A computer hacker learns about the true nature of reality.',
      genres: ['Action', 'Sci-Fi'],
    },
  },
}

// Alias for backwards compatibility
const commonSchemas = schemas

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

// Aperture logo SVG - exported for use in logo route
export const apertureLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#grad)" stroke-width="4"/>
  <path d="M50 15 L65 35 L85 50 L65 65 L50 85 L35 65 L15 50 L35 35 Z" fill="url(#grad)" opacity="0.9"/>
  <circle cx="50" cy="50" r="12" fill="#1a1a2e"/>
</svg>`

// Custom CSS to style Swagger UI with Aperture branding
const customCss = `
  .topbar-wrapper img { content: url("/api/logo.svg"); }
  .topbar-wrapper .link::after { content: "Aperture API"; margin-left: 8px; font-size: 1.5em; font-weight: bold; }
`

export const swaggerUIConfig: FastifySwaggerUiOptions = {
  routePrefix: '/openapi',
  uiConfig: {
    docExpansion: 'none',
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
  staticCSP: false,
  transformSpecification: (swaggerObject) => {
    return swaggerObject
  },
  transformSpecificationClone: true,
  theme: {
    title: 'Aperture API',
    css: [{ filename: 'theme.css', content: customCss }],
  },
}
