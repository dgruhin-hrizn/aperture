/**
 * Setup OpenAPI Schemas
 * 
 * All OpenAPI/Swagger schema definitions for setup wizard endpoints.
 */

// =============================================================================
// Setup Status & Progress Schemas
// =============================================================================

const getStatus = {
  tags: ['setup'],
  summary: 'Get setup status',
  description: 'Check if initial setup is needed. Public endpoint.',
}

const getProgress = {
  tags: ['setup'],
  summary: 'Get setup progress',
  description: 'Get current wizard progress and configuration snapshot (first-run only or admin).',
}

const updateProgress = {
  tags: ['setup'],
  summary: 'Update setup progress',
  description: 'Update wizard progress for resume support (first-run only or admin).',
  body: {
    type: 'object' as const,
    properties: {
      currentStep: { type: 'string' as const, nullable: true },
      completedStep: { type: 'string' as const },
      reset: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// Media Server Setup Schemas
// =============================================================================

const getMediaServerTypes = {
  tags: ['setup'],
  summary: 'Get media server types',
  description: 'Get list of supported media server types (Emby, Jellyfin).',
}

const discoverServers = {
  tags: ['setup'],
  summary: 'Discover servers',
  description: 'Auto-discover Emby/Jellyfin servers on the local network via UDP.',
}

const testMediaServer = {
  tags: ['setup'],
  summary: 'Test media server connection',
  description: 'Test connection to a media server with provided credentials.',
  body: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'] },
      baseUrl: { type: 'string' as const },
      apiKey: { type: 'string' as const },
    },
    required: ['type', 'baseUrl', 'apiKey'] as string[],
  },
}

const saveMediaServer = {
  tags: ['setup'],
  summary: 'Save media server configuration',
  description: 'Save media server configuration during setup.',
  body: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'] },
      baseUrl: { type: 'string' as const },
      apiKey: { type: 'string' as const },
    },
    required: ['type', 'baseUrl', 'apiKey'] as string[],
  },
}

const getMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Get security settings',
  description: 'Get media server security settings (passwordless login).',
}

const updateMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Update security settings',
  description: 'Update media server security settings.',
  body: {
    type: 'object' as const,
    properties: {
      allowPasswordlessLogin: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// Library Setup Schemas
// =============================================================================

const getLibraries = {
  tags: ['setup'],
  summary: 'Get libraries',
  description: 'Get available libraries from configured media server.',
}

const setLibraries = {
  tags: ['setup'],
  summary: 'Configure libraries',
  description: 'Enable/disable libraries for recommendation processing.',
  body: {
    type: 'object' as const,
    properties: {
      libraries: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            providerLibraryId: { type: 'string' as const },
            isEnabled: { type: 'boolean' as const },
          },
          required: ['providerLibraryId', 'isEnabled'] as string[],
        },
      },
    },
    required: ['libraries'] as string[],
  },
}

// =============================================================================
// Output Configuration Schemas
// =============================================================================

const getAiRecsOutput = {
  tags: ['setup'],
  summary: 'Get AI recommendations output config',
  description: 'Get current AI recommendations output configuration.',
}

const setAiRecsOutput = {
  tags: ['setup'],
  summary: 'Set AI recommendations output config',
  description: 'Configure how AI recommendations are output.',
}

const getOutputConfig = {
  tags: ['setup'],
  summary: 'Get output path config',
  description: 'Get current output path configuration.',
}

const setOutputConfig = {
  tags: ['setup'],
  summary: 'Set output path config',
  description: 'Configure output paths for recommendations.',
}

const detectPaths = {
  tags: ['setup'],
  summary: 'Detect path mappings',
  description: 'Auto-detect path mappings between Aperture and media server.',
}

const validate = {
  tags: ['setup'],
  summary: 'Validate setup',
  description: 'Run validation checks to ensure setup is correct.',
  body: {
    type: 'object' as const,
    properties: {
      useSymlinks: { type: 'boolean' as const },
    },
  },
}

const uploadLibraryImage = {
  tags: ['setup'],
  summary: 'Upload library image',
  description: 'Upload a custom image for a library type.',
  params: {
    type: 'object' as const,
    properties: {
      libraryType: { type: 'string' as const },
    },
    required: ['libraryType'] as string[],
  },
}

// =============================================================================
// Top Picks Setup Schemas
// =============================================================================

const getTopPicksConfig = {
  tags: ['setup'],
  summary: 'Get Top Picks config',
  description: 'Get Top Picks configuration during setup.',
}

const setTopPicksConfig = {
  tags: ['setup'],
  summary: 'Set Top Picks config',
  description: 'Configure Top Picks feature during setup.',
}

// =============================================================================
// User Import Schemas
// =============================================================================

const getUsers = {
  tags: ['setup'],
  summary: 'Get users for import',
  description: 'Get users from media server for import during setup.',
}

const importUser = {
  tags: ['setup'],
  summary: 'Import user',
  description: 'Import a user from media server.',
  body: {
    type: 'object' as const,
    properties: {
      providerUserId: { type: 'string' as const },
      moviesEnabled: { type: 'boolean' as const },
      seriesEnabled: { type: 'boolean' as const },
    },
    required: ['providerUserId'] as string[],
  },
}

const enableUser = {
  tags: ['setup'],
  summary: 'Enable/disable user',
  description: 'Enable or disable a user for recommendations.',
  body: {
    type: 'object' as const,
    properties: {
      apertureUserId: { type: 'string' as const },
      moviesEnabled: { type: 'boolean' as const },
      seriesEnabled: { type: 'boolean' as const },
    },
    required: ['apertureUserId'] as string[],
  },
}

// =============================================================================
// OpenAI Setup Schemas
// =============================================================================

const testOpenAI = {
  tags: ['setup'],
  summary: 'Test OpenAI connection',
  description: 'Test OpenAI API connection with provided key.',
  body: {
    type: 'object' as const,
    properties: {
      apiKey: { type: 'string' as const },
    },
    required: ['apiKey'] as string[],
  },
}

const getOpenAI = {
  tags: ['setup'],
  summary: 'Get OpenAI config',
  description: 'Get OpenAI configuration status during setup.',
}

const saveOpenAI = {
  tags: ['setup'],
  summary: 'Save OpenAI config',
  description: 'Save OpenAI API key during setup.',
  body: {
    type: 'object' as const,
    properties: {
      apiKey: { type: 'string' as const },
    },
    required: ['apiKey'] as string[],
  },
}

// =============================================================================
// Job Trigger Schemas
// =============================================================================

const runJob = {
  tags: ['setup'],
  summary: 'Run setup job',
  description: 'Trigger a job during setup (sync, embeddings, etc.).',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const },
    },
    required: ['name'] as string[],
  },
}

const getJobProgress = {
  tags: ['setup'],
  summary: 'Get job progress',
  description: 'Get progress of a running job.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const },
    },
    required: ['jobId'] as string[],
  },
}

const getLastRuns = {
  tags: ['setup'],
  summary: 'Get last job runs',
  description: 'Get information about recent job runs.',
}

// =============================================================================
// Setup Completion Schemas
// =============================================================================

const completeSetup = {
  tags: ['setup'],
  summary: 'Complete setup',
  description: 'Mark setup as complete.',
}

// =============================================================================
// Admin Setup Re-run Schemas
// =============================================================================

const adminRunInitialJobs = {
  tags: ['setup'],
  summary: 'Run initial jobs (admin)',
  description: 'Run all initial setup jobs in order.',
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
  description: 'Get available AI providers for setup.',
  querystring: {
    type: 'object' as const,
    properties: {
      function: { type: 'string' as const },
    },
  },
}

const getAIModels = {
  tags: ['setup'],
  summary: 'Get AI models',
  description: 'Get available AI models for a provider.',
  querystring: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const },
    },
    required: ['provider', 'function'] as string[],
  },
}

const addCustomModel = {
  tags: ['setup'],
  summary: 'Add custom AI model',
  description: 'Add a custom AI model definition.',
  body: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const },
      modelId: { type: 'string' as const },
      embeddingDimensions: { type: 'number' as const },
    },
    required: ['provider', 'function', 'modelId'] as string[],
  },
}

const deleteCustomModel = {
  tags: ['setup'],
  summary: 'Delete custom AI model',
  description: 'Delete a custom AI model definition.',
  body: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const },
      modelId: { type: 'string' as const },
    },
    required: ['provider', 'function', 'modelId'] as string[],
  },
}

const getAICredentials = {
  tags: ['setup'],
  summary: 'Get AI credentials',
  description: 'Get AI provider credentials (masked).',
  params: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
    },
    required: ['provider'] as string[],
  },
}

const getAIFunctionConfig = {
  tags: ['setup'],
  summary: 'Get AI function config',
  description: 'Get configuration for a specific AI function.',
  params: {
    type: 'object' as const,
    properties: {
      function: { type: 'string' as const },
    },
    required: ['function'] as string[],
  },
}

const testAIProvider = {
  tags: ['setup'],
  summary: 'Test AI provider',
  description: 'Test connection to an AI provider.',
  body: {
    type: 'object' as const,
    properties: {
      function: { type: 'string' as const },
      provider: { type: 'string' as const },
      model: { type: 'string' as const },
      apiKey: { type: 'string' as const },
      baseUrl: { type: 'string' as const },
    },
    required: ['function', 'provider', 'model'] as string[],
  },
}

const updateAIFunctionConfig = {
  tags: ['setup'],
  summary: 'Update AI function config',
  description: 'Update configuration for a specific AI function.',
  params: {
    type: 'object' as const,
    properties: {
      function: { type: 'string' as const },
    },
    required: ['function'] as string[],
  },
  body: {
    type: 'object' as const,
    properties: {
      provider: { type: 'string' as const },
      model: { type: 'string' as const },
      apiKey: { type: 'string' as const },
      baseUrl: { type: 'string' as const },
    },
    required: ['provider', 'model'] as string[],
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
