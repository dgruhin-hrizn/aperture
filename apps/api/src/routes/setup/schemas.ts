/**
 * Setup OpenAPI Schemas
 * 
 * Setup wizard endpoints for initial configuration.
 * Most endpoints are only available during first-run setup or to admins.
 */

// =============================================================================
// Setup Status & Progress Schemas
// =============================================================================

const getStatus = {
  tags: ['setup'],
  summary: 'Get setup status',
  description: 'Check if initial setup is needed. Public endpoint, no authentication required.',
  security: [],
}

const getProgress = {
  tags: ['setup'],
  summary: 'Get setup progress',
  description: 'Get current wizard progress and configuration snapshot. Available during first-run or to admins for re-running setup.',
}

const updateProgress = {
  tags: ['setup'],
  summary: 'Update setup progress',
  description: 'Update wizard progress for resume support. Tracks which steps have been completed.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      currentStep: { type: 'string' as const, nullable: true, description: 'Current step being worked on' },
      completedStep: { type: 'string' as const, description: 'Step that was just completed' },
      reset: { type: 'boolean' as const, description: 'If true, reset all progress', default: false },
    },
    example: {
      completedStep: 'media-server',
      currentStep: 'libraries',
    },
  },
}

// =============================================================================
// Media Server Setup Schemas
// =============================================================================

const getMediaServerTypes = {
  tags: ['setup'],
  summary: 'Get media server types',
  description: 'Get list of supported media server types for the setup wizard.',
}

const discoverServers = {
  tags: ['setup'],
  summary: 'Discover servers',
  description: 'Auto-discover Emby/Jellyfin servers on the local network via UDP broadcast. May take a few seconds.',
}

const testMediaServer = {
  tags: ['setup'],
  summary: 'Test media server connection',
  description: 'Test connection to a media server with provided credentials. Use this to verify settings before saving.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['type', 'baseUrl', 'apiKey'] as string[],
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type' },
      baseUrl: { type: 'string' as const, description: 'Server URL including protocol and port', example: 'http://192.168.1.100:8096' },
      apiKey: { type: 'string' as const, description: 'API key from server admin settings' },
    },
  },
}

const saveMediaServer = {
  tags: ['setup'],
  summary: 'Save media server configuration',
  description: 'Save media server configuration during setup. Should test connection first.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['type', 'baseUrl', 'apiKey'] as string[],
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type' },
      baseUrl: { type: 'string' as const, description: 'Server URL', example: 'http://192.168.1.100:8096' },
      apiKey: { type: 'string' as const, description: 'API key' },
    },
  },
}

const getMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Get security settings',
  description: 'Get media server security settings including passwordless login option.',
}

const updateMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Update security settings',
  description: 'Update media server security settings. Passwordless login is useful for trusted networks.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      allowPasswordlessLogin: { type: 'boolean' as const, description: 'Allow users without passwords to log in' },
    },
  },
}

// =============================================================================
// Library Setup Schemas
// =============================================================================

const getLibraries = {
  tags: ['setup'],
  summary: 'Get libraries',
  description: 'Get available libraries from the configured media server. Shows library name, type, and item count.',
}

const setLibraries = {
  tags: ['setup'],
  summary: 'Configure libraries',
  description: 'Enable or disable libraries for recommendation processing. Only enabled libraries are synced and included in recommendations.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['libraries'] as string[],
    properties: {
      libraries: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          required: ['providerLibraryId', 'isEnabled'] as string[],
          properties: {
            providerLibraryId: { type: 'string' as const, description: 'Library ID from media server' },
            isEnabled: { type: 'boolean' as const, description: 'Whether to enable this library' },
          },
        },
        description: 'Array of library configurations',
      },
    },
    example: {
      libraries: [
        { providerLibraryId: 'lib-001', isEnabled: true },
        { providerLibraryId: 'lib-002', isEnabled: false },
      ],
    },
  },
}

// =============================================================================
// Output Configuration Schemas
// =============================================================================

const getAiRecsOutput = {
  tags: ['setup'],
  summary: 'Get AI recommendations output config',
  description: 'Get current configuration for how AI recommendations are output (poster images, STRM files).',
}

const setAiRecsOutput = {
  tags: ['setup'],
  summary: 'Set AI recommendations output config',
  description: 'Configure how AI recommendations are output. Poster mode creates virtual library images, STRM mode creates playable files.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      format: { type: 'string' as const, enum: ['poster', 'strm', 'both', 'none'], description: 'Output format' },
      strmPath: { type: 'string' as const, description: 'Path for STRM file output' },
      posterFormat: { type: 'string' as const, enum: ['png', 'jpg', 'webp'], description: 'Poster image format' },
      posterQuality: { type: 'integer' as const, minimum: 1, maximum: 100, description: 'Poster quality' },
    },
  },
}

const getOutputConfig = {
  tags: ['setup'],
  summary: 'Get output path config',
  description: 'Get current output path configuration for recommendations.',
}

const setOutputConfig = {
  tags: ['setup'],
  summary: 'Set output path config',
  description: 'Configure output paths for recommendations. Symlinks are more efficient but require the media server to access the same filesystem.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      outputPath: { type: 'string' as const, description: 'Base output path for recommendation files' },
      useSymlinks: { type: 'boolean' as const, description: 'Use symlinks instead of file copies' },
    },
  },
}

const detectPaths = {
  tags: ['setup'],
  summary: 'Detect path mappings',
  description: 'Auto-detect path mappings between Aperture container and media server. Useful when they run in different containers.',
}

const validate = {
  tags: ['setup'],
  summary: 'Validate setup',
  description: 'Run validation checks to ensure setup is correct. Tests file access, path mappings, and connectivity.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      useSymlinks: { type: 'boolean' as const, description: 'Test symlink creation' },
    },
  },
}

const uploadLibraryImage = {
  tags: ['setup'],
  summary: 'Upload library image',
  description: 'Upload a custom image for a library type (movies or series). Used for virtual library artwork.',
  params: {
    type: 'object' as const,
    required: ['libraryType'] as string[],
    properties: {
      libraryType: { type: 'string' as const, enum: ['movies', 'series'], description: 'Library type to set image for' },
    },
  },
  consumes: ['multipart/form-data'],
}

// =============================================================================
// Top Picks Setup Schemas
// =============================================================================

const getTopPicksConfig = {
  tags: ['setup'],
  summary: 'Get Top Picks config',
  description: 'Get Top Picks feature configuration during setup.',
}

const setTopPicksConfig = {
  tags: ['setup'],
  summary: 'Set Top Picks config',
  description: 'Configure Top Picks feature during setup. Top Picks shows highly-rated unwatched content.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      movies: {
        type: 'object' as const,
        properties: {
          enabled: { type: 'boolean' as const },
          itemCount: { type: 'integer' as const, minimum: 1, maximum: 50 },
        },
      },
      series: {
        type: 'object' as const,
        properties: {
          enabled: { type: 'boolean' as const },
          itemCount: { type: 'integer' as const, minimum: 1, maximum: 50 },
        },
      },
    },
  },
}

// =============================================================================
// User Import Schemas
// =============================================================================

const getUsers = {
  tags: ['setup'],
  summary: 'Get users for import',
  description: 'Get users from media server for import during setup. Shows which users are already imported.',
}

const importUser = {
  tags: ['setup'],
  summary: 'Import user',
  description: 'Import a user from media server into Aperture. Can enable/disable recommendations per media type.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['providerUserId'] as string[],
    properties: {
      providerUserId: { type: 'string' as const, description: 'User ID from media server' },
      moviesEnabled: { type: 'boolean' as const, description: 'Enable movie recommendations', default: true },
      seriesEnabled: { type: 'boolean' as const, description: 'Enable series recommendations', default: true },
    },
  },
}

const enableUser = {
  tags: ['setup'],
  summary: 'Enable/disable user',
  description: 'Enable or disable recommendations for an imported user.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['apertureUserId'] as string[],
    properties: {
      apertureUserId: { type: 'string' as const, format: 'uuid', description: 'Aperture user ID' },
      moviesEnabled: { type: 'boolean' as const, description: 'Enable movie recommendations' },
      seriesEnabled: { type: 'boolean' as const, description: 'Enable series recommendations' },
    },
  },
}

// =============================================================================
// OpenAI Setup Schemas (Legacy)
// =============================================================================

const testOpenAI = {
  tags: ['setup'],
  summary: 'Test OpenAI connection',
  description: 'Test OpenAI API connection with provided key. Legacy endpoint - prefer /ai/test.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['apiKey'] as string[],
    properties: {
      apiKey: { type: 'string' as const, description: 'OpenAI API key to test' },
    },
  },
}

const getOpenAI = {
  tags: ['setup'],
  summary: 'Get OpenAI config',
  description: 'Get OpenAI configuration status during setup. Legacy endpoint.',
}

const saveOpenAI = {
  tags: ['setup'],
  summary: 'Save OpenAI config',
  description: 'Save OpenAI API key during setup. Legacy endpoint - prefer /ai/credentials.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['apiKey'] as string[],
    properties: {
      apiKey: { type: 'string' as const, description: 'OpenAI API key' },
    },
  },
}

// =============================================================================
// Job Trigger Schemas
// =============================================================================

const runJob = {
  tags: ['setup'],
  summary: 'Run setup job',
  description: 'Trigger a job during setup (sync, embeddings, etc.). Jobs run asynchronously.',
  params: {
    type: 'object' as const,
    required: ['name'] as string[],
    properties: {
      name: { 
        type: 'string' as const, 
        description: 'Job name to run',
        enum: ['sync-movies', 'sync-series', 'enrich-movies', 'enrich-series', 'embed-movies', 'embed-series']
      },
    },
  },
}

const getJobProgress = {
  tags: ['setup'],
  summary: 'Get job progress',
  description: 'Get progress of a running job.',
  params: {
    type: 'object' as const,
    required: ['jobId'] as string[],
    properties: {
      jobId: { type: 'string' as const, format: 'uuid', description: 'Job run ID' },
    },
  },
}

const getLastRuns = {
  tags: ['setup'],
  summary: 'Get last job runs',
  description: 'Get information about recent job runs during setup.',
}

// =============================================================================
// Setup Completion Schemas
// =============================================================================

const completeSetup = {
  tags: ['setup'],
  summary: 'Complete setup',
  description: 'Mark initial setup as complete. After this, setup endpoints require admin authentication.',
}

// =============================================================================
// Admin Setup Re-run Schemas
// =============================================================================

const adminRunInitialJobs = {
  tags: ['setup'],
  summary: 'Run initial jobs (admin)',
  description: 'Run all initial setup jobs in order (sync, enrich, embed). Admin only.',
}

const adminGetProgress = {
  tags: ['setup'],
  summary: 'Get setup progress (admin)',
  description: 'Get setup progress for admin re-run.',
}

const adminUpdateProgress = {
  tags: ['setup'],
  summary: 'Update setup progress (admin)',
  description: 'Update setup progress for admin re-run.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      currentStep: { type: 'string' as const, nullable: true },
      completedStep: { type: 'string' as const },
      reset: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// AI Provider Setup Schemas
// =============================================================================

const getAIProviders = {
  tags: ['setup'],
  summary: 'Get AI providers',
  description: 'Get available AI providers for a specific function (embeddings, chat, textGeneration, exploration).',
  querystring: {
    type: 'object' as const,
    properties: {
      function: { 
        type: 'string' as const, 
        enum: ['embeddings', 'chat', 'textGeneration', 'exploration'],
        description: 'AI function type'
      },
    },
  },
}

const getAIModels = {
  tags: ['setup'],
  summary: 'Get AI models',
  description: 'Get available AI models for a specific provider and function.',
  querystring: {
    type: 'object' as const,
    required: ['provider', 'function'] as string[],
    properties: {
      provider: { type: 'string' as const, description: 'Provider ID', example: 'openai' },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
    },
  },
}

const addCustomModel = {
  tags: ['setup'],
  summary: 'Add custom AI model',
  description: 'Add a custom AI model definition for providers that support custom models (e.g., Ollama, LM Studio).',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['provider', 'function', 'modelId'] as string[],
    properties: {
      provider: { type: 'string' as const, description: 'Provider ID' },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
      modelId: { type: 'string' as const, description: 'Model identifier' },
      embeddingDimensions: { type: 'number' as const, description: 'Embedding dimensions (required for embedding models)' },
    },
    example: {
      provider: 'ollama',
      function: 'embeddings',
      modelId: 'nomic-embed-text',
      embeddingDimensions: 768,
    },
  },
}

const deleteCustomModel = {
  tags: ['setup'],
  summary: 'Delete custom AI model',
  description: 'Delete a custom AI model definition.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['provider', 'function', 'modelId'] as string[],
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
      modelId: { type: 'string' as const },
    },
  },
}

const getAICredentials = {
  tags: ['setup'],
  summary: 'Get AI credentials',
  description: 'Get AI provider credentials status (masked). Does not expose actual API keys.',
  params: {
    type: 'object' as const,
    required: ['provider'] as string[],
    properties: {
      provider: { type: 'string' as const, description: 'Provider ID' },
    },
  },
}

const getAIFunctionConfig = {
  tags: ['setup'],
  summary: 'Get AI function config',
  description: 'Get current configuration for a specific AI function.',
  params: {
    type: 'object' as const,
    required: ['function'] as string[],
    properties: {
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
    },
  },
}

const testAIProvider = {
  tags: ['setup'],
  summary: 'Test AI provider',
  description: 'Test connection to an AI provider with specific model and credentials.',
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['function', 'provider', 'model'] as string[],
    properties: {
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
      provider: { type: 'string' as const },
      model: { type: 'string' as const },
      apiKey: { type: 'string' as const, description: 'API key to test (optional, uses saved if not provided)' },
      baseUrl: { type: 'string' as const, description: 'Custom base URL (optional)' },
    },
  },
}

const updateAIFunctionConfig = {
  tags: ['setup'],
  summary: 'Update AI function config',
  description: 'Update configuration for a specific AI function including provider, model, and credentials.',
  params: {
    type: 'object' as const,
    required: ['function'] as string[],
    properties: {
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
    },
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    required: ['provider', 'model'] as string[],
    properties: {
      provider: { type: 'string' as const },
      model: { type: 'string' as const },
      apiKey: { type: 'string' as const, description: 'API key (optional if already saved)' },
      baseUrl: { type: 'string' as const, description: 'Custom base URL (optional)' },
    },
    example: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'sk-...',
    },
  },
}

// =============================================================================
// Export all schemas as a consolidated object
// =============================================================================

export const setupSchemas = {
  // Status & Progress
  getStatus,
  getProgress,
  updateProgress,
  
  // Media Server
  getMediaServerTypes,
  discoverServers,
  testMediaServer,
  saveMediaServer,
  getMediaServerSecurity,
  updateMediaServerSecurity,
  
  // Libraries
  getLibraries,
  setLibraries,
  
  // Output Config
  getAiRecsOutput,
  setAiRecsOutput,
  getOutputConfig,
  setOutputConfig,
  detectPaths,
  validate,
  uploadLibraryImage,
  
  // Top Picks
  getTopPicksConfig,
  setTopPicksConfig,
  
  // Users
  getUsers,
  importUser,
  enableUser,
  
  // OpenAI
  testOpenAI,
  getOpenAI,
  saveOpenAI,
  
  // Jobs
  runJob,
  getJobProgress,
  getLastRuns,
  
  // Setup Completion
  completeSetup,
  
  // Admin
  adminRunInitialJobs,
  adminGetProgress,
  adminUpdateProgress,
  
  // AI Providers
  getAIProviders,
  getAIModels,
  addCustomModel,
  deleteCustomModel,
  getAICredentials,
  getAIFunctionConfig,
  testAIProvider,
  updateAIFunctionConfig,
}
