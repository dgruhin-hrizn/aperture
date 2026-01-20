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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        isSetupComplete: { type: 'boolean' as const, description: 'Whether initial setup has been completed' },
        isFirstRun: { type: 'boolean' as const, description: 'True if this is the first time running Aperture' },
        version: { type: 'string' as const, description: 'Aperture version' },
      },
      example: {
        isSetupComplete: false,
        isFirstRun: true,
        version: '0.6.1',
      },
    },
  },
}

const getProgress = {
  tags: ['setup'],
  summary: 'Get setup progress',
  description: 'Get current wizard progress and configuration snapshot. Available during first-run or to admins for re-running setup.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        currentStep: { type: 'string' as const, nullable: true, description: 'Current step ID', example: 'media-server' },
        completedSteps: { type: 'array' as const, items: { type: 'string' as const }, description: 'List of completed step IDs' },
        config: { type: 'object' as const, description: 'Current configuration snapshot' },
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

const updateProgress = {
  tags: ['setup'],
  summary: 'Update setup progress',
  description: 'Update wizard progress for resume support. Tracks which steps have been completed.',
  body: {
    type: 'object' as const,
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
// Media Server Setup Schemas
// =============================================================================

const getMediaServerTypes = {
  tags: ['setup'],
  summary: 'Get media server types',
  description: 'Get list of supported media server types for the setup wizard.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        types: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, enum: ['emby', 'jellyfin'] },
              name: { type: 'string' as const, description: 'Display name' },
              description: { type: 'string' as const },
            },
          },
          example: [
            { id: 'jellyfin', name: 'Jellyfin', description: 'Free and open-source media server' },
            { id: 'emby', name: 'Emby', description: 'Personal media server' },
          ],
        },
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

const discoverServers = {
  tags: ['setup'],
  summary: 'Discover servers',
  description: 'Auto-discover Emby/Jellyfin servers on the local network via UDP broadcast. May take a few seconds.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        servers: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              type: { type: 'string' as const, enum: ['emby', 'jellyfin'] },
              name: { type: 'string' as const, description: 'Server name' },
              address: { type: 'string' as const, description: 'Server URL' },
            },
          },
        },
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

const testMediaServer = {
  tags: ['setup'],
  summary: 'Test media server connection',
  description: 'Test connection to a media server with provided credentials. Use this to verify settings before saving.',
  body: {
    type: 'object' as const,
    required: ['type', 'baseUrl', 'apiKey'] as string[],
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type' },
      baseUrl: { type: 'string' as const, description: 'Server URL including protocol and port', example: 'http://192.168.1.100:8096' },
      apiKey: { type: 'string' as const, description: 'API key from server admin settings' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        serverName: { type: 'string' as const, nullable: true, description: 'Server name if connection successful' },
        version: { type: 'string' as const, nullable: true, description: 'Server version' },
        error: { type: 'string' as const, nullable: true, description: 'Error message if failed' },
      },
    },
  },
}

const saveMediaServer = {
  tags: ['setup'],
  summary: 'Save media server configuration',
  description: 'Save media server configuration during setup. Should test connection first.',
  body: {
    type: 'object' as const,
    required: ['type', 'baseUrl', 'apiKey'] as string[],
    properties: {
      type: { type: 'string' as const, enum: ['emby', 'jellyfin'], description: 'Server type' },
      baseUrl: { type: 'string' as const, description: 'Server URL', example: 'http://192.168.1.100:8096' },
      apiKey: { type: 'string' as const, description: 'API key' },
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

const getMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Get security settings',
  description: 'Get media server security settings including passwordless login option.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        allowPasswordlessLogin: { type: 'boolean' as const, description: 'Whether passwordless login is allowed' },
      },
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
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

const updateMediaServerSecurity = {
  tags: ['setup'],
  summary: 'Update security settings',
  description: 'Update media server security settings. Passwordless login is useful for trusted networks.',
  body: {
    type: 'object' as const,
    properties: {
      allowPasswordlessLogin: { type: 'boolean' as const, description: 'Allow users without passwords to log in' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
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

// =============================================================================
// Library Setup Schemas
// =============================================================================

const getLibraries = {
  tags: ['setup'],
  summary: 'Get libraries',
  description: 'Get available libraries from the configured media server. Shows library name, type, and item count.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        libraries: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              providerLibraryId: { type: 'string' as const, description: 'Library ID in media server' },
              name: { type: 'string' as const, description: 'Library name' },
              type: { type: 'string' as const, enum: ['movies', 'tvshows'], description: 'Library content type' },
              itemCount: { type: 'integer' as const, description: 'Number of items in library' },
              isEnabled: { type: 'boolean' as const, description: 'Whether library is enabled for Aperture' },
            },
          },
        },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
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

const setLibraries = {
  tags: ['setup'],
  summary: 'Configure libraries',
  description: 'Enable or disable libraries for recommendation processing. Only enabled libraries are synced and included in recommendations.',
  body: {
    type: 'object' as const,
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        enabledCount: { type: 'integer' as const, description: 'Number of enabled libraries' },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        format: { type: 'string' as const, enum: ['poster', 'strm', 'both', 'none'], description: 'Output format' },
        strmPath: { type: 'string' as const, nullable: true, description: 'Path for STRM file output' },
        posterFormat: { type: 'string' as const, enum: ['png', 'jpg', 'webp'], description: 'Poster image format' },
        posterQuality: { type: 'integer' as const, description: 'Poster quality (1-100)' },
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

const setAiRecsOutput = {
  tags: ['setup'],
  summary: 'Set AI recommendations output config',
  description: 'Configure how AI recommendations are output. Poster mode creates virtual library images, STRM mode creates playable files.',
  body: {
    type: 'object' as const,
    properties: {
      format: { type: 'string' as const, enum: ['poster', 'strm', 'both', 'none'], description: 'Output format' },
      strmPath: { type: 'string' as const, description: 'Path for STRM file output' },
      posterFormat: { type: 'string' as const, enum: ['png', 'jpg', 'webp'], description: 'Poster image format' },
      posterQuality: { type: 'integer' as const, minimum: 1, maximum: 100, description: 'Poster quality' },
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

const getOutputConfig = {
  tags: ['setup'],
  summary: 'Get output path config',
  description: 'Get current output path configuration for recommendations.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        outputPath: { type: 'string' as const, description: 'Base output path' },
        useSymlinks: { type: 'boolean' as const, description: 'Whether to use symlinks instead of copies' },
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

const setOutputConfig = {
  tags: ['setup'],
  summary: 'Set output path config',
  description: 'Configure output paths for recommendations. Symlinks are more efficient but require the media server to access the same filesystem.',
  body: {
    type: 'object' as const,
    properties: {
      outputPath: { type: 'string' as const, description: 'Base output path for recommendation files' },
      useSymlinks: { type: 'boolean' as const, description: 'Use symlinks instead of file copies' },
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

const detectPaths = {
  tags: ['setup'],
  summary: 'Detect path mappings',
  description: 'Auto-detect path mappings between Aperture container and media server. Useful when they run in different containers.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        detected: { type: 'boolean' as const, description: 'Whether paths were successfully detected' },
        mappings: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              aperturePath: { type: 'string' as const },
              serverPath: { type: 'string' as const },
            },
          },
        },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
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

const validate = {
  tags: ['setup'],
  summary: 'Validate setup',
  description: 'Run validation checks to ensure setup is correct. Tests file access, path mappings, and connectivity.',
  body: {
    type: 'object' as const,
    properties: {
      useSymlinks: { type: 'boolean' as const, description: 'Test symlink creation' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        valid: { type: 'boolean' as const, description: 'Whether all checks passed' },
        checks: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
              passed: { type: 'boolean' as const },
              message: { type: 'string' as const },
            },
          },
        },
      },
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        path: { type: 'string' as const, description: 'Path to uploaded image' },
      },
    },
  },
}

// =============================================================================
// Top Picks Setup Schemas
// =============================================================================

const getTopPicksConfig = {
  tags: ['setup'],
  summary: 'Get Top Picks config',
  description: 'Get Top Picks feature configuration during setup.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        movies: {
          type: 'object' as const,
          properties: {
            enabled: { type: 'boolean' as const },
            itemCount: { type: 'integer' as const },
          },
        },
        series: {
          type: 'object' as const,
          properties: {
            enabled: { type: 'boolean' as const },
            itemCount: { type: 'integer' as const },
          },
        },
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

const setTopPicksConfig = {
  tags: ['setup'],
  summary: 'Set Top Picks config',
  description: 'Configure Top Picks feature during setup. Top Picks shows highly-rated unwatched content.',
  body: {
    type: 'object' as const,
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
// User Import Schemas
// =============================================================================

const getUsers = {
  tags: ['setup'],
  summary: 'Get users for import',
  description: 'Get users from media server for import during setup. Shows which users are already imported.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        users: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              providerUserId: { type: 'string' as const, description: 'User ID in media server' },
              username: { type: 'string' as const },
              isAdmin: { type: 'boolean' as const },
              isImported: { type: 'boolean' as const, description: 'Whether already imported to Aperture' },
              apertureUserId: { type: 'string' as const, format: 'uuid', nullable: true, description: 'Aperture user ID if imported' },
            },
          },
        },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
    403: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
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

const importUser = {
  tags: ['setup'],
  summary: 'Import user',
  description: 'Import a user from media server into Aperture. Can enable/disable recommendations per media type.',
  body: {
    type: 'object' as const,
    required: ['providerUserId'] as string[],
    properties: {
      providerUserId: { type: 'string' as const, description: 'User ID from media server' },
      moviesEnabled: { type: 'boolean' as const, description: 'Enable movie recommendations', default: true },
      seriesEnabled: { type: 'boolean' as const, description: 'Enable series recommendations', default: true },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        userId: { type: 'string' as const, format: 'uuid', description: 'New Aperture user ID' },
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

const enableUser = {
  tags: ['setup'],
  summary: 'Enable/disable user',
  description: 'Enable or disable recommendations for an imported user.',
  body: {
    type: 'object' as const,
    required: ['apertureUserId'] as string[],
    properties: {
      apertureUserId: { type: 'string' as const, format: 'uuid', description: 'Aperture user ID' },
      moviesEnabled: { type: 'boolean' as const, description: 'Enable movie recommendations' },
      seriesEnabled: { type: 'boolean' as const, description: 'Enable series recommendations' },
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
// OpenAI Setup Schemas (Legacy)
// =============================================================================

const testOpenAI = {
  tags: ['setup'],
  summary: 'Test OpenAI connection',
  description: 'Test OpenAI API connection with provided key. Legacy endpoint - prefer /ai/test.',
  body: {
    type: 'object' as const,
    required: ['apiKey'] as string[],
    properties: {
      apiKey: { type: 'string' as const, description: 'OpenAI API key to test' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        error: { type: 'string' as const, nullable: true },
      },
    },
  },
}

const getOpenAI = {
  tags: ['setup'],
  summary: 'Get OpenAI config',
  description: 'Get OpenAI configuration status during setup. Legacy endpoint.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        hasApiKey: { type: 'boolean' as const },
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

const saveOpenAI = {
  tags: ['setup'],
  summary: 'Save OpenAI config',
  description: 'Save OpenAI API key during setup. Legacy endpoint - prefer /ai/credentials.',
  body: {
    type: 'object' as const,
    required: ['apiKey'] as string[],
    properties: {
      apiKey: { type: 'string' as const, description: 'OpenAI API key' },
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        jobId: { type: 'string' as const, format: 'uuid', description: 'Job run ID for tracking progress' },
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const, enum: ['running', 'success', 'failed', 'cancelled'] },
        progress: { type: 'number' as const, description: 'Progress percentage (0-100)' },
        itemsProcessed: { type: 'integer' as const },
        itemsTotal: { type: 'integer' as const },
        currentItem: { type: 'string' as const, nullable: true },
      },
    },
  },
}

const getLastRuns = {
  tags: ['setup'],
  summary: 'Get last job runs',
  description: 'Get information about recent job runs during setup.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        runs: {
          type: 'object' as const,
          additionalProperties: {
            type: 'object' as const,
            properties: {
              status: { type: 'string' as const },
              completedAt: { type: 'string' as const, format: 'date-time', nullable: true },
            },
          },
        },
      },
    },
    403: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

// =============================================================================
// Setup Completion Schemas
// =============================================================================

const completeSetup = {
  tags: ['setup'],
  summary: 'Complete setup',
  description: 'Mark initial setup as complete. After this, setup endpoints require admin authentication.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const, example: 'Setup complete! You can now log in.' },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
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
// Admin Setup Re-run Schemas
// =============================================================================

const adminRunInitialJobs = {
  tags: ['setup'],
  summary: 'Run initial jobs (admin)',
  description: 'Run all initial setup jobs in order (sync, enrich, embed). Admin only.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
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

const adminGetProgress = {
  tags: ['setup'],
  summary: 'Get setup progress (admin)',
  description: 'Get setup progress for admin re-run.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        currentStep: { type: 'string' as const, nullable: true },
        completedSteps: { type: 'array' as const, items: { type: 'string' as const } },
      },
    },
  },
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
// AI Provider Setup Schemas
// =============================================================================

const getAIProviders = {
  tags: ['setup'],
  summary: 'Get AI providers',
  description: 'Get available AI providers for a specific function (embedding, text generation, chat).',
  querystring: {
    type: 'object' as const,
    properties: {
      function: { 
        type: 'string' as const, 
        enum: ['embedding', 'text_generation', 'chat_assistant'],
        description: 'AI function type'
      },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        providers: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Provider ID', example: 'openai' },
              name: { type: 'string' as const, description: 'Display name', example: 'OpenAI' },
              hasCredentials: { type: 'boolean' as const, description: 'Whether API key is configured' },
              supportsCustomBaseUrl: { type: 'boolean' as const },
            },
          },
        },
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
      function: { type: 'string' as const, enum: ['embedding', 'text_generation', 'chat_assistant'] },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        models: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Model ID' },
              name: { type: 'string' as const, description: 'Display name' },
              contextWindow: { type: 'integer' as const, nullable: true },
              isCustom: { type: 'boolean' as const },
            },
          },
        },
      },
    },
  },
}

const addCustomModel = {
  tags: ['setup'],
  summary: 'Add custom AI model',
  description: 'Add a custom AI model definition for providers that support custom models (e.g., Ollama, LM Studio).',
  body: {
    type: 'object' as const,
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
      },
    },
  },
}

const deleteCustomModel = {
  tags: ['setup'],
  summary: 'Delete custom AI model',
  description: 'Delete a custom AI model definition.',
  body: {
    type: 'object' as const,
    required: ['provider', 'function', 'modelId'] as string[],
    properties: {
      provider: { type: 'string' as const },
      function: { type: 'string' as const, enum: ['embeddings', 'chat', 'textGeneration', 'exploration'] },
      modelId: { type: 'string' as const },
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
  response: {
    200: {
      type: 'object' as const,
      properties: {
        hasApiKey: { type: 'boolean' as const },
        hasBaseUrl: { type: 'boolean' as const },
        baseUrl: { type: 'string' as const, nullable: true, description: 'Custom base URL if set' },
      },
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
      function: { type: 'string' as const, enum: ['embedding', 'text_generation', 'chat_assistant'] },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        provider: { type: 'string' as const, nullable: true },
        model: { type: 'string' as const, nullable: true },
        isConfigured: { type: 'boolean' as const },
      },
    },
  },
}

const testAIProvider = {
  tags: ['setup'],
  summary: 'Test AI provider',
  description: 'Test connection to an AI provider with specific model and credentials.',
  body: {
    type: 'object' as const,
    required: ['function', 'provider', 'model'] as string[],
    properties: {
      function: { type: 'string' as const, enum: ['embedding', 'text_generation', 'chat_assistant'] },
      provider: { type: 'string' as const },
      model: { type: 'string' as const },
      apiKey: { type: 'string' as const, description: 'API key to test (optional, uses saved if not provided)' },
      baseUrl: { type: 'string' as const, description: 'Custom base URL (optional)' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        error: { type: 'string' as const, nullable: true },
        modelInfo: { type: 'object' as const, nullable: true, description: 'Model information if successful' },
      },
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
      function: { type: 'string' as const, enum: ['embedding', 'text_generation', 'chat_assistant'] },
    },
  },
  body: {
    type: 'object' as const,
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
