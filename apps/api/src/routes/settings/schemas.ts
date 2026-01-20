/**
 * Settings OpenAPI Schemas
 * 
 * All OpenAPI/Swagger schema definitions for settings endpoints.
 * Admin endpoints are marked with "(admin only)" in descriptions.
 */

// =============================================================================
// Media Server Schemas
// =============================================================================

export const mediaServerInfoSchema = {
  tags: ['settings'],
  summary: 'Get media server info',
  description: 'Get public media server information for frontend use (play buttons, deep links). Available to all authenticated users. Returns server type, base URL, and server name.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        type: { type: 'string' as const, enum: ['emby', 'jellyfin'], nullable: true, description: 'Media server type' },
        baseUrl: { type: 'string' as const, nullable: true, description: 'Server base URL for building play links' },
        serverId: { type: 'string' as const, nullable: true, description: 'Media server unique identifier' },
        serverName: { type: 'string' as const, nullable: true, description: 'Server display name' },
        webClientUrl: { type: 'string' as const, description: 'Full URL to web client' },
        isConfigured: { type: 'boolean' as const, description: 'Whether media server is fully configured' },
      },
      example: {
        type: 'jellyfin',
        baseUrl: 'http://192.168.1.100:8096',
        serverId: 'abc123',
        serverName: 'Home Server',
        webClientUrl: 'http://192.168.1.100:8096/web/index.html',
        isConfigured: true,
      },
    },
  },
}

export const mediaServerConfigSchema = {
  tags: ['settings'],
  summary: 'Get media server configuration',
  description: 'Get media server configuration details (admin only). API key is not exposed for security, only indicates if one is configured.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        config: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, enum: ['emby', 'jellyfin'], nullable: true },
            baseUrl: { type: 'string' as const, nullable: true },
            hasApiKey: { type: 'boolean' as const, description: 'Whether an API key is configured' },
            isConfigured: { type: 'boolean' as const, description: 'Whether media server is fully configured' },
          },
        },
        serverTypes: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              name: { type: 'string' as const },
            },
          },
          description: 'Available media server types',
        },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const updateMediaServerConfigSchema = {
  tags: ['settings'],
  summary: 'Update media server configuration',
  description: 'Update media server connection settings including type, URL, and API key (admin only). After updating, use the test endpoint to verify connectivity.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type (Emby or Jellyfin)' },
      baseUrl: { type: 'string' as const, description: 'Server base URL including protocol and port', example: 'http://localhost:8096' },
      apiKey: { type: 'string' as const, description: 'API key for server access. Generate from server admin settings.' },
    },
    example: {
      type: 'jellyfin',
      baseUrl: 'http://192.168.1.100:8096',
      apiKey: 'your-api-key-here',
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        config: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, enum: ['emby', 'jellyfin'], nullable: true },
            baseUrl: { type: 'string' as const, nullable: true },
            hasApiKey: { type: 'boolean' as const },
            isConfigured: { type: 'boolean' as const },
          },
        },
        message: { type: 'string' as const },
      },
    },
  },
}

export const mediaServerSecuritySchema = {
  tags: ['settings'],
  summary: 'Get security settings',
  description: 'Get media server security settings including passwordless login option (admin only).',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        allowPasswordlessLogin: { type: 'boolean' as const, description: 'Whether passwordless login is allowed' },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const updateMediaServerSecuritySchema = {
  tags: ['settings'],
  summary: 'Update security settings',
  description: 'Update media server security settings (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      allowPasswordlessLogin: { type: 'boolean' as const, description: 'Allow users without passwords to log in' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        allowPasswordlessLogin: { type: 'boolean' as const, description: 'Updated passwordless login setting' },
        message: { type: 'string' as const },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const testMediaServerSchema = {
  tags: ['settings'],
  summary: 'Test media server connection',
  description: 'Test connection to media server with provided or saved credentials (admin only). Use this to verify configuration before saving.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type to test' },
      baseUrl: { type: 'string' as const, description: 'Server URL to test', example: 'http://localhost:8096' },
      apiKey: { type: 'string' as const, description: 'API key to test' },
      useSavedCredentials: { type: 'boolean' as const, description: 'If true, ignores other fields and tests saved credentials', default: false },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        serverName: { type: 'string' as const, nullable: true, description: 'Server name if connection successful' },
        version: { type: 'string' as const, nullable: true, description: 'Server version' },
        error: { type: 'string' as const, nullable: true, description: 'Error message if connection failed' },
      },
    },
  },
}

// =============================================================================
// Library Configuration Schemas
// =============================================================================

export const librariesSchema = {
  tags: ['settings'],
  summary: 'Get library configurations',
  description: 'Get all library configurations with enabled status and item counts (admin only).',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        libraries: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const syncLibrariesSchema = {
  tags: ['settings'],
  summary: 'Sync libraries from media server',
  description: 'Sync library configurations from the media server. Creates new entries for newly discovered libraries (admin only).',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const },
        libraries: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const availableLibrariesSchema = {
  tags: ['settings'],
  summary: 'Get available libraries',
  description: 'Get available libraries directly from media server before syncing (admin only).',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        libraries: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
        movieCount: { type: 'integer' as const },
        tvShowCount: { type: 'integer' as const },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

export const updateLibrarySchema = {
  tags: ['settings'],
  summary: 'Update library enabled status',
  description: 'Enable or disable a library for recommendations and browsing (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Library config ID' },
    },
    required: ['id'] as string[],
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      isEnabled: { type: 'boolean' as const, description: 'Whether library is enabled' },
    },
    required: ['isEnabled'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        library: { type: 'object' as const, additionalProperties: true },
      },
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

// =============================================================================
// Recommendation Configuration Schemas
// =============================================================================

export const recommendationConfigSchema = {
  tags: ['settings'],
  summary: 'Get recommendation configuration',
  description: 'Get recommendation algorithm configuration for movies and series including weights, pool sizes, and enabled status (admin only).',
}

export const updateRecommendationConfigSchema = {
  tags: ['settings'],
  summary: 'Update recommendation configuration',
  description: 'Update recommendation algorithm weights and settings for movies or series (admin only). Weights should sum to 1.0 for best results.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' as const, description: 'Enable/disable recommendations for this media type' },
      maxCandidates: { type: 'integer' as const, minimum: 10, description: 'Maximum candidates to evaluate. Use a very large number (e.g., 999999999) for unlimited.', example: 500 },
      selectedCount: { type: 'integer' as const, minimum: 1, maximum: 100, description: 'Number of recommendations to select', example: 20 },
      recentWatchLimit: { type: 'integer' as const, minimum: 1, description: 'Number of recent watches to consider for similarity', example: 50 },
      similarityWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for semantic similarity to watched content (0-1)', example: 0.4 },
      noveltyWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for content novelty/freshness (0-1)', example: 0.2 },
      ratingWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for critic/community ratings (0-1)', example: 0.2 },
      diversityWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for genre diversity in results (0-1)', example: 0.2 },
    },
    example: {
      similarityWeight: 0.4,
      noveltyWeight: 0.2,
      ratingWeight: 0.2,
      diversityWeight: 0.2,
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
  },
}

export const resetRecommendationConfigSchema = {
  tags: ['settings'],
  summary: 'Reset recommendation configuration',
  description: 'Reset recommendation algorithm configuration to defaults (admin only).',
}

// =============================================================================
// Cost Inputs Schema
// =============================================================================

export const costInputsSchema = {
  tags: ['settings'],
  summary: 'Get cost estimation inputs',
  description: 'Get data needed for AI cost estimation including content counts, user counts, model info, and job schedules (admin only).',
}

// =============================================================================
// User Settings Schemas
// =============================================================================

export const userSettingsSchema = {
  tags: ['settings'],
  summary: 'Get user settings',
  description: 'Get current user preferences including theme, default tab, and display options.',
}

export const updateUserSettingsSchema = {
  tags: ['settings'],
  summary: 'Update user settings',
  description: 'Update current user preferences. Only provided fields are updated (partial update).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      defaultTab: { type: 'string' as const, description: 'Default tab to show on dashboard', example: 'movies' },
      theme: { type: 'string' as const, enum: ['light', 'dark', 'system'], description: 'UI theme preference' },
      enableAnimations: { type: 'boolean' as const, description: 'Enable UI animations' },
      cardSize: { type: 'string' as const, enum: ['small', 'medium', 'large'], description: 'Poster card size in grid views' },
      showPlotSummaries: { type: 'boolean' as const, description: 'Show plot summaries on cards' },
      enableSpoilerProtection: { type: 'boolean' as const, description: 'Hide spoilers for unwatched content' },
    },
    example: {
      theme: 'dark',
      cardSize: 'medium',
      enableAnimations: true,
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
      },
    },
  },
}

// =============================================================================
// AI Model Settings Schemas
// =============================================================================

export const embeddingModelSchema = {
  tags: ['settings'],
  summary: 'Get embedding model settings',
  description: 'Get current embedding model configuration and available models (admin only).',
}

export const updateEmbeddingModelSchema = {
  tags: ['settings'],
  summary: 'Update embedding model',
  description: 'Set the embedding model to use for content similarity (admin only). Changing models requires re-embedding all content.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      model: { type: 'string' as const, description: 'Model ID to use' },
    },
    required: ['model'] as string[],
  },
}

export const textGenerationModelSchema = {
  tags: ['settings'],
  summary: 'Get text generation model settings',
  description: 'Get current text generation model configuration and available models (admin only).',
}

export const updateTextGenerationModelSchema = {
  tags: ['settings'],
  summary: 'Update text generation model',
  description: 'Set the text generation model to use for explanations and descriptions (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      model: { type: 'string' as const },
    },
    required: ['model'] as string[],
  },
}

export const chatAssistantModelSchema = {
  tags: ['settings'],
  summary: 'Get chat assistant model settings',
  description: 'Get current chat assistant model configuration and available models (admin only).',
}

export const updateChatAssistantModelSchema = {
  tags: ['settings'],
  summary: 'Update chat assistant model',
  description: 'Set the chat assistant model to use for AI conversations (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      model: { type: 'string' as const },
    },
    required: ['model'] as string[],
  },
}

// =============================================================================
// Top Picks Configuration Schemas
// =============================================================================

export const topPicksConfigSchema = {
  tags: ['settings'],
  summary: 'Get Top Picks configuration',
  description: 'Get Top Picks feature configuration including schedules and item counts for movies and series (admin only).',
}

export const updateTopPicksConfigSchema = {
  tags: ['settings'],
  summary: 'Update Top Picks configuration',
  description: 'Update Top Picks feature settings for movies and/or series (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true, // Allow all properties - handler validates what it needs
    properties: {
      isEnabled: { type: 'boolean' as const, description: 'Enable/disable Top Picks feature' },
      // Popularity sources
      moviesPopularitySource: { type: 'string' as const, description: 'Source for movie popularity data' },
      seriesPopularitySource: { type: 'string' as const, description: 'Source for series popularity data' },
      moviesHybridExternalSource: { type: 'string' as const, description: 'External source for hybrid mode (movies)' },
      seriesHybridExternalSource: { type: 'string' as const, description: 'External source for hybrid mode (series)' },
      // Time windows and thresholds
      moviesTimeWindowDays: { type: 'integer' as const, minimum: 1, description: 'Time window in days for movie popularity' },
      seriesTimeWindowDays: { type: 'integer' as const, minimum: 1, description: 'Time window in days for series popularity' },
      moviesMinUniqueViewers: { type: 'integer' as const, minimum: 1, description: 'Minimum unique viewers for movies' },
      seriesMinUniqueViewers: { type: 'integer' as const, minimum: 1, description: 'Minimum unique viewers for series' },
      // List size
      moviesUseAllMatches: { type: 'boolean' as const, description: 'Use all matching movies instead of limiting count' },
      seriesUseAllMatches: { type: 'boolean' as const, description: 'Use all matching series instead of limiting count' },
      moviesCount: { type: 'integer' as const, minimum: 1, description: 'Number of movies to show' },
      seriesCount: { type: 'integer' as const, minimum: 1, description: 'Number of series to show' },
      // Algorithm weights (0-1)
      uniqueViewersWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for unique viewers (0-1)' },
      playCountWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for play count (0-1)' },
      completionWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for completion rate (0-1)' },
      hybridLocalWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for local data in hybrid mode (0-1)' },
      hybridExternalWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for external data in hybrid mode (0-1)' },
      // Output configuration
      moviesLibraryEnabled: { type: 'boolean' as const },
      moviesCollectionEnabled: { type: 'boolean' as const },
      moviesPlaylistEnabled: { type: 'boolean' as const },
      seriesLibraryEnabled: { type: 'boolean' as const },
      seriesCollectionEnabled: { type: 'boolean' as const },
      seriesPlaylistEnabled: { type: 'boolean' as const },
      moviesLibraryName: { type: 'string' as const },
      seriesLibraryName: { type: 'string' as const },
      moviesCollectionName: { type: 'string' as const },
      seriesCollectionName: { type: 'string' as const },
      moviesUseSymlinks: { type: 'boolean' as const },
      seriesUseSymlinks: { type: 'boolean' as const },
      // MDBList configuration
      mdblistMoviesListId: { type: ['integer', 'null'] as const },
      mdblistSeriesListId: { type: ['integer', 'null'] as const },
      mdblistMoviesListName: { type: ['string', 'null'] as const },
      mdblistSeriesListName: { type: ['string', 'null'] as const },
      mdblistMoviesSort: { type: 'string' as const },
      mdblistSeriesSort: { type: 'string' as const },
      // Auto-request configuration
      moviesAutoRequestEnabled: { type: 'boolean' as const },
      moviesAutoRequestLimit: { type: 'integer' as const, minimum: 1 },
      seriesAutoRequestEnabled: { type: 'boolean' as const },
      seriesAutoRequestLimit: { type: 'integer' as const, minimum: 1 },
      autoRequestCron: { type: 'string' as const },
      // Language filters
      moviesLanguages: { type: 'array' as const, items: { type: 'string' as const } },
      seriesLanguages: { type: 'array' as const, items: { type: 'string' as const } },
      moviesIncludeUnknownLanguage: { type: 'boolean' as const },
      seriesIncludeUnknownLanguage: { type: 'boolean' as const },
      // Schedule
      refreshCron: { type: 'string' as const },
    },
  },
}

// =============================================================================
// AI Output Format Schemas
// =============================================================================

export const aiRecsOutputConfigSchema = {
  tags: ['settings'],
  summary: 'Get AI recommendations output configuration',
  description: 'Get configuration for how AI recommendations are output (poster images, STRM files, etc.) (admin only).',
}

export const updateAiRecsOutputConfigSchema = {
  tags: ['settings'],
  summary: 'Update AI recommendations output configuration',
  description: 'Update how AI recommendations are output (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      format: { type: 'string' as const, enum: ['poster', 'strm', 'both', 'none'] },
      strmPath: { type: 'string' as const },
      posterFormat: { type: 'string' as const, enum: ['png', 'jpg', 'webp'] },
      posterQuality: { type: 'integer' as const, minimum: 1, maximum: 100 },
    },
  },
}

export const aiExplanationConfigSchema = {
  tags: ['settings'],
  summary: 'Get AI explanation configuration',
  description: 'Get system-wide AI explanation settings (admin only).',
}

export const updateAiExplanationConfigSchema = {
  tags: ['settings'],
  summary: 'Update AI explanation configuration',
  description: 'Update system-wide AI explanation settings (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' as const },
      allowUserOverride: { type: 'boolean' as const },
      defaultEnabled: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// User AI Explanation Preference Schemas
// =============================================================================

export const userAiExplanationSchema = {
  tags: ['settings'],
  summary: 'Get user AI explanation preference',
  description: 'Get current user AI explanation preference and effective setting.',
}

export const updateUserAiExplanationSchema = {
  tags: ['settings'],
  summary: 'Update user AI explanation preference',
  description: 'Update current user AI explanation preference (if override is allowed).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' as const },
    },
    required: ['enabled'] as string[],
  },
}

// =============================================================================
// Watching Library Schemas
// =============================================================================

export const watchingLibraryConfigSchema = {
  tags: ['settings'],
  summary: 'Get watching library configuration',
  description: 'Get configuration for the "Shows You Watch" library feature (admin only).',
}

export const updateWatchingLibraryConfigSchema = {
  tags: ['settings'],
  summary: 'Update watching library configuration',
  description: 'Update configuration for the "Shows You Watch" library feature (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' as const },
      movieLibraryName: { type: 'string' as const },
      seriesLibraryName: { type: 'string' as const },
    },
  },
}

// =============================================================================
// User Preference Schemas
// =============================================================================

export const includeWatchedSchema = {
  tags: ['settings'],
  summary: 'Get include watched preference',
  description: 'Get whether to include already-watched content in recommendations.',
}

export const updateIncludeWatchedSchema = {
  tags: ['settings'],
  summary: 'Update include watched preference',
  description: 'Set whether to include already-watched content in recommendations.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      movies: { type: 'boolean' as const },
      series: { type: 'boolean' as const },
    },
  },
}

export const dislikeBehaviorSchema = {
  tags: ['settings'],
  summary: 'Get dislike behavior preference',
  description: 'Get how disliked content affects recommendations.',
}

export const updateDislikeBehaviorSchema = {
  tags: ['settings'],
  summary: 'Update dislike behavior preference',
  description: 'Set how disliked content affects recommendations. "exclude" removes them entirely, "reduce" lowers their score, "ignore" has no effect.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      behavior: { 
        type: 'string' as const, 
        enum: ['exclude', 'reduce', 'ignore'],
        description: 'How to handle disliked content: exclude (never recommend), reduce (lower score), ignore (no effect)'
      },
      reductionFactor: { 
        type: 'number' as const, 
        minimum: 0, 
        maximum: 1,
        description: 'Score multiplier when behavior is "reduce" (0.5 = half score)',
        example: 0.3
      },
    },
    example: {
      behavior: 'reduce',
      reductionFactor: 0.3,
    },
  },
}

export const similarityPrefsSchema = {
  tags: ['settings'],
  summary: 'Get similarity graph preferences',
  description: 'Get user preferences for similarity graph display.',
}

export const updateSimilarityPrefsSchema = {
  tags: ['settings'],
  summary: 'Update similarity graph preferences',
  description: 'Update user preferences for similarity graph display.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      minSimilarity: { type: 'number' as const, minimum: 0, maximum: 1 },
      maxResults: { type: 'integer' as const, minimum: 1, maximum: 100 },
      includeWatched: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// Library Title Templates Schemas
// =============================================================================

export const libraryTitleConfigSchema = {
  tags: ['settings'],
  summary: 'Get library title templates',
  description: 'Get templates for generating recommendation library names (admin only).',
}

export const updateLibraryTitleConfigSchema = {
  tags: ['settings'],
  summary: 'Update library title templates',
  description: 'Update templates for generating recommendation library names (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      movieTemplate: { type: 'string' as const },
      seriesTemplate: { type: 'string' as const },
    },
  },
}

// =============================================================================
// STRM Library Schemas
// =============================================================================

export const strmLibrariesSchema = {
  tags: ['settings'],
  summary: 'Get STRM libraries',
  description: 'Get all STRM libraries created by Aperture for recommendations (admin only).',
}

// =============================================================================
// OpenAI Legacy Schemas
// =============================================================================

export const openaiConfigSchema = {
  tags: ['settings'],
  summary: 'Get OpenAI configuration (legacy)',
  description: 'Get OpenAI API key configuration status. Use /api/settings/ai for multi-provider config (admin only).',
}

export const updateOpenaiConfigSchema = {
  tags: ['settings'],
  summary: 'Update OpenAI configuration (legacy)',
  description: 'Update OpenAI API key. Use /api/settings/ai for multi-provider config (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const },
    },
    required: ['apiKey'] as string[],
  },
}

export const testOpenaiSchema = {
  tags: ['settings'],
  summary: 'Test OpenAI connection (legacy)',
  description: 'Test OpenAI API connection (admin only).',
}

// =============================================================================
// Multi-Provider AI Configuration Schemas
// =============================================================================

export const aiConfigSchema = {
  tags: ['settings'],
  summary: 'Get AI configuration',
  description: 'Get multi-provider AI configuration including enabled providers and model assignments (admin only).',
}

export const aiCapabilitiesSchema = {
  tags: ['settings'],
  summary: 'Get AI capabilities status',
  description: 'Get status of AI capabilities based on current configuration (admin only).',
}

export const aiFeaturesSchema = {
  tags: ['settings'],
  summary: 'Get AI features for current user',
  description: 'Get which AI features are enabled for the current user based on system config and permissions.',
}

export const aiCredentialsSchema = {
  tags: ['settings'],
  summary: 'Get AI provider credentials status',
  description: 'Get which AI providers have credentials configured. Does not expose actual keys (admin only).',
}

export const updateAiCredentialSchema = {
  tags: ['settings'],
  summary: 'Update AI provider credentials',
  description: 'Set API key and/or base URL for an AI provider (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const, description: 'Provider ID' },
    },
    required: ['provider'] as string[],
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const },
      baseUrl: { type: 'string' as const },
    },
  },
}

export const aiProvidersSchema = {
  tags: ['settings'],
  summary: 'Get available AI providers',
  description: 'Get list of available AI providers for a specific function (admin only).',
  querystring: {
    type: 'object' as const,
    properties: {
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
    },
    // function is optional - if not provided, returns all providers
  },
}

export const aiModelsSchema = {
  tags: ['settings'],
  summary: 'Get available AI models',
  description: 'Get list of available AI models for a provider and function (admin only).',
  querystring: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
    },
    required: ['provider', 'function'] as string[],
  },
}

export const testAiProviderSchema = {
  tags: ['settings'],
  summary: 'Test AI provider connection',
  description: 'Test connection to an AI provider using provided or saved credentials (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      provider: { type: 'string' as const, description: 'Provider ID' },
      apiKey: { type: 'string' as const, description: 'API key to test (optional, uses saved if not provided)' },
      baseUrl: { type: 'string' as const, description: 'Base URL (optional)' },
    },
    required: ['provider'] as string[],
  },
}

export const addCustomModelSchema = {
  tags: ['settings'],
  summary: 'Add custom AI model',
  description: 'Add a custom AI model definition (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      provider: { type: 'string' as const },
      modelId: { type: 'string' as const },
      displayName: { type: 'string' as const },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
      contextWindow: { type: 'integer' as const },
      inputPrice: { type: 'number' as const },
      outputPrice: { type: 'number' as const },
    },
    required: ['provider', 'modelId', 'function'] as string[],
  },
}

export const deleteCustomModelSchema = {
  tags: ['settings'],
  summary: 'Delete custom AI model',
  description: 'Delete a custom AI model definition (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      modelId: { type: 'string' as const },
    },
    required: ['provider', 'modelId'] as string[],
  },
}

// =============================================================================
// AI Pricing Schemas
// =============================================================================

export const aiPricingSchema = {
  tags: ['settings'],
  summary: 'Get AI model pricing',
  description: 'Get pricing information for AI models (admin only).',
}

export const aiPricingStatusSchema = {
  tags: ['settings'],
  summary: 'Get AI pricing cache status',
  description: 'Get the status of the AI pricing cache (admin only).',
}

export const refreshAiPricingSchema = {
  tags: ['settings'],
  summary: 'Refresh AI pricing cache',
  description: 'Refresh the AI pricing cache from external sources (admin only).',
}

// =============================================================================
// Embedding Management Schemas
// =============================================================================

export const embeddingSetsSchema = {
  tags: ['settings'],
  summary: 'Get embedding sets',
  description: 'Get all embedding sets with their statistics and active status (admin only).',
}

export const deleteEmbeddingSetSchema = {
  tags: ['settings'],
  summary: 'Delete embedding set',
  description: 'Delete embeddings for a specific model (admin only).',
  params: {
    type: 'object' as const,
    properties: {
      model: { type: 'string' as const, description: 'Model name to delete embeddings for' },
    },
    required: ['model'] as string[],
  },
}

export const clearAllEmbeddingsSchema = {
  tags: ['settings'],
  summary: 'Clear all embeddings',
  description: 'Delete all embeddings for all models (admin only). Use with caution.',
}

export const legacyEmbeddingsSchema = {
  tags: ['settings'],
  summary: 'Check legacy embeddings',
  description: 'Check if legacy embedding tables exist from older versions (admin only).',
}

export const deleteLegacyEmbeddingsSchema = {
  tags: ['settings'],
  summary: 'Delete legacy embeddings',
  description: 'Delete legacy embedding tables from older versions (admin only).',
}

// =============================================================================
// Integration Schemas (TMDb, OMDb, Studio Logos)
// =============================================================================

export const tmdbConfigSchema = {
  tags: ['settings'],
  summary: 'Get TMDb configuration',
  description: 'Get TMDb API configuration status (admin only).',
}

export const updateTmdbConfigSchema = {
  tags: ['settings'],
  summary: 'Update TMDb configuration',
  description: 'Update TMDb API key (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const, description: 'TMDb API key (v3)' },
    },
  },
}

export const testTmdbSchema = {
  tags: ['settings'],
  summary: 'Test TMDb connection',
  description: 'Test TMDb API connection with provided or saved key (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const, description: 'API key to test (optional)' },
    },
  },
}

export const omdbConfigSchema = {
  tags: ['settings'],
  summary: 'Get OMDb configuration',
  description: 'Get OMDb API configuration status (admin only).',
}

export const updateOmdbConfigSchema = {
  tags: ['settings'],
  summary: 'Update OMDb configuration',
  description: 'Update OMDb API key (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const, description: 'OMDb API key' },
    },
  },
}

export const testOmdbSchema = {
  tags: ['settings'],
  summary: 'Test OMDb connection',
  description: 'Test OMDb API connection with provided or saved key (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      apiKey: { type: 'string' as const, description: 'API key to test (optional)' },
    },
  },
}

export const studioLogosConfigSchema = {
  tags: ['settings'],
  summary: 'Get studio logos configuration',
  description: 'Get studio logos feature configuration (admin only).',
}

export const updateStudioLogosConfigSchema = {
  tags: ['settings'],
  summary: 'Update studio logos configuration',
  description: 'Update studio logos feature configuration (admin only).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' as const },
      tmdbEnabled: { type: 'boolean' as const },
      fanarttv: {
        type: 'object' as const,
        properties: {
          enabled: { type: 'boolean' as const },
          apiKey: { type: 'string' as const },
        },
      },
    },
  },
}

// =============================================================================
// Taste Profile Schemas
// =============================================================================

export const tasteProfileSchema = {
  tags: ['settings'],
  summary: 'Get taste profile',
  description: 'Get user taste profile including liked and disliked items. Admins can query other users.',
  querystring: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID (admin can query other users)' },
    },
  },
}

export const addTasteProfileItemSchema = {
  tags: ['settings'],
  summary: 'Add taste profile item',
  description: 'Add a movie or series to taste profile as like or dislike.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      movieId: { type: 'string' as const, format: 'uuid' },
      seriesId: { type: 'string' as const, format: 'uuid' },
      isLike: { type: 'boolean' as const, description: 'True for like, false for dislike' },
    },
    required: ['isLike'] as string[],
  },
}

export const updateTasteProfileItemSchema = {
  tags: ['settings'],
  summary: 'Update taste profile item',
  description: 'Update an item in the taste profile (change like to dislike or vice versa).',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as string[],
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      isLike: { type: 'boolean' as const },
    },
    required: ['isLike'] as string[],
  },
}

export const deleteTasteProfileItemSchema = {
  tags: ['settings'],
  summary: 'Remove taste profile item',
  description: 'Remove an item from the taste profile.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as string[],
  },
}

// =============================================================================
// Custom Interest Schemas
// =============================================================================

export const customInterestsSchema = {
  tags: ['settings'],
  summary: 'Get custom interests',
  description: 'Get user custom interests for recommendation personalization.',
}

export const addCustomInterestSchema = {
  tags: ['settings'],
  summary: 'Add custom interest',
  description: 'Add a custom interest description for recommendation personalization.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      description: { type: 'string' as const, description: 'Interest description' },
      weight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Interest weight' },
    },
    required: ['description'] as string[],
  },
}

export const updateCustomInterestSchema = {
  tags: ['settings'],
  summary: 'Update custom interest',
  description: 'Update a custom interest.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as string[],
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      description: { type: 'string' as const },
      weight: { type: 'number' as const, minimum: 0, maximum: 1 },
    },
  },
}

export const deleteCustomInterestSchema = {
  tags: ['settings'],
  summary: 'Delete custom interest',
  description: 'Delete a custom interest.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
    required: ['id'] as string[],
  },
}
