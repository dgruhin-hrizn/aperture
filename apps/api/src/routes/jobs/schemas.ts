/**
 * Jobs OpenAPI Schemas
 * 
 * Background job management and scheduling. All endpoints require admin privileges.
 */

// =============================================================================
// Job Names Enum (for documentation)
// =============================================================================

const JOB_NAMES = [
  'sync-movies',
  'sync-series', 
  'enrich-movies',
  'enrich-series',
  'embed-movies',
  'embed-series',
  'sync-watch-history',
  'recommendations-movies',
  'recommendations-series',
  'top-picks',
  'discovery-movies',
  'discovery-series',
] as const

// =============================================================================
// Component Schemas
// =============================================================================

export const jobComponentSchemas = {
  // Job definition
  Job: {
    type: 'object' as const,
    description: 'Background job definition with status and schedule',
    properties: {
      name: { type: 'string' as const, description: 'Unique job identifier', example: 'sync-movies' },
      displayName: { type: 'string' as const, description: 'Human-readable job name', example: 'Sync Movies' },
      description: { type: 'string' as const, description: 'What this job does' },
      category: { type: 'string' as const, enum: ['sync', 'enrich', 'embed', 'recommendations', 'discovery'], description: 'Job category' },
      isEnabled: { type: 'boolean' as const, description: 'Whether the job is enabled' },
      isRunning: { type: 'boolean' as const, description: 'Whether the job is currently running' },
      scheduleType: { type: 'string' as const, enum: ['daily', 'weekly', 'interval', 'manual'], description: 'Schedule type' },
      scheduleHour: { type: 'integer' as const, nullable: true, description: 'Hour to run (0-23) for daily/weekly schedules' },
      scheduleMinute: { type: 'integer' as const, nullable: true, description: 'Minute to run (0-59)' },
      scheduleDayOfWeek: { type: 'integer' as const, nullable: true, description: 'Day of week (0=Sunday) for weekly schedules' },
      scheduleIntervalHours: { type: 'integer' as const, nullable: true, description: 'Interval in hours for interval schedules' },
      nextRunAt: { type: 'string' as const, format: 'date-time', nullable: true, description: 'Next scheduled run time' },
      lastRunAt: { type: 'string' as const, format: 'date-time', nullable: true, description: 'Last run time' },
      lastRunStatus: { type: 'string' as const, enum: ['success', 'failed', 'cancelled'], nullable: true, description: 'Last run status' },
      lastRunDurationMs: { type: 'integer' as const, nullable: true, description: 'Last run duration in milliseconds' },
    },
  },

  // Job run history entry
  JobRun: {
    type: 'object' as const,
    description: 'A single job run record',
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Run ID' },
      jobName: { type: 'string' as const, description: 'Job name' },
      status: { type: 'string' as const, enum: ['running', 'success', 'failed', 'cancelled'], description: 'Run status' },
      startedAt: { type: 'string' as const, format: 'date-time', description: 'When the run started' },
      completedAt: { type: 'string' as const, format: 'date-time', nullable: true, description: 'When the run completed' },
      durationMs: { type: 'integer' as const, nullable: true, description: 'Duration in milliseconds' },
      itemsProcessed: { type: 'integer' as const, nullable: true, description: 'Number of items processed' },
      itemsTotal: { type: 'integer' as const, nullable: true, description: 'Total items to process' },
      errorMessage: { type: 'string' as const, nullable: true, description: 'Error message if failed' },
      triggeredBy: { type: 'string' as const, enum: ['schedule', 'manual', 'setup'], description: 'How the run was triggered' },
    },
  },

  // Job progress
  JobProgress: {
    type: 'object' as const,
    description: 'Real-time job progress',
    properties: {
      jobId: { type: 'string' as const, format: 'uuid', description: 'Run ID' },
      jobName: { type: 'string' as const, description: 'Job name' },
      status: { type: 'string' as const, enum: ['running', 'success', 'failed', 'cancelled'] },
      progress: { type: 'number' as const, description: 'Progress percentage (0-100)' },
      currentItem: { type: 'string' as const, nullable: true, description: 'Currently processing item' },
      itemsProcessed: { type: 'integer' as const, description: 'Items processed so far' },
      itemsTotal: { type: 'integer' as const, description: 'Total items to process' },
      startedAt: { type: 'string' as const, format: 'date-time' },
      estimatedTimeRemaining: { type: 'integer' as const, nullable: true, description: 'Estimated seconds remaining' },
    },
  },
} as const

// =============================================================================
// Job List & Status Schemas
// =============================================================================

const listJobs = {
  tags: ['jobs'],
  summary: 'List all jobs',
  description: 'Get all background jobs with their status, schedule configuration, and last run info. Admin only.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        jobs: { type: 'array' as const, items: { $ref: 'Job#' } },
      },
    },
  },
}

const getJob = {
  tags: ['jobs'],
  summary: 'Get job details',
  description: 'Get detailed information for a specific job including schedule and run history.',
  params: {
    type: 'object' as const,
    properties: {
      name: { 
        type: 'string' as const, 
        description: 'Job name identifier',
        example: 'sync-movies'
      },
    },
    required: ['name'] as string[],
  },
  response: {
    200: { $ref: 'Job#' },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Job not found' },
      },
    },
  },
}

const runJob = {
  tags: ['jobs'],
  summary: 'Run job manually',
  description: 'Trigger a job to run immediately. The job will run asynchronously - use the progress endpoints to monitor.',
  params: {
    type: 'object' as const,
    properties: {
      name: { 
        type: 'string' as const, 
        description: 'Job name to run',
        example: 'sync-movies'
      },
    },
    required: ['name'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        jobId: { type: 'string' as const, format: 'uuid', description: 'ID of the started job run' },
        message: { type: 'string' as const, example: 'Job started' },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Job is already running' },
      },
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Job not found' },
      },
    },
  },
}

const cancelJob = {
  tags: ['jobs'],
  summary: 'Cancel running job',
  description: 'Cancel a currently running job. The job will stop at the next safe point.',
  params: {
    type: 'object' as const,
    properties: {
      name: { 
        type: 'string' as const, 
        description: 'Job name to cancel',
        example: 'enrich-movies'
      },
    },
    required: ['name'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const, example: 'Job cancellation requested' },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Job is not running' },
      },
    },
  },
}

// =============================================================================
// Job Configuration Schemas
// =============================================================================

const getJobConfig = {
  tags: ['jobs'],
  summary: 'Get job schedule configuration',
  description: 'Get the schedule configuration for a specific job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name', example: 'sync-movies' },
    },
    required: ['name'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        scheduleType: { type: 'string' as const, enum: ['daily', 'weekly', 'interval', 'manual'] },
        scheduleHour: { type: 'integer' as const, nullable: true },
        scheduleMinute: { type: 'integer' as const, nullable: true },
        scheduleDayOfWeek: { type: 'integer' as const, nullable: true },
        scheduleIntervalHours: { type: 'integer' as const, nullable: true },
        isEnabled: { type: 'boolean' as const },
      },
    },
  },
}

const updateJobConfig = {
  tags: ['jobs'],
  summary: 'Update job schedule configuration',
  description: 'Update the schedule configuration for a specific job. Changes take effect immediately.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name', example: 'sync-movies' },
    },
    required: ['name'] as string[],
  },
  body: {
    type: 'object' as const,
    description: 'Schedule configuration (partial update)',
    properties: {
      scheduleType: {
        type: 'string' as const,
        enum: ['daily', 'weekly', 'interval', 'manual'],
        description: 'Schedule type: daily (runs once per day), weekly (runs once per week), interval (runs every N hours), manual (only runs when triggered)',
      },
      scheduleHour: { type: 'number' as const, nullable: true, minimum: 0, maximum: 23, description: 'Hour to run (0-23). Required for daily/weekly.' },
      scheduleMinute: { type: 'number' as const, nullable: true, minimum: 0, maximum: 59, description: 'Minute to run (0-59). Defaults to 0.' },
      scheduleDayOfWeek: { type: 'number' as const, nullable: true, minimum: 0, maximum: 6, description: 'Day of week (0=Sunday, 6=Saturday). Required for weekly.' },
      scheduleIntervalHours: { type: 'number' as const, nullable: true, minimum: 1, description: 'Interval in hours. Required for interval schedule.' },
      isEnabled: { type: 'boolean' as const, description: 'Whether the job is enabled' },
    },
    example: {
      scheduleType: 'daily',
      scheduleHour: 3,
      scheduleMinute: 0,
      isEnabled: true,
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const, example: 'Job configuration updated' },
      },
    },
  },
}

// =============================================================================
// Job Progress Schemas
// =============================================================================

const getJobProgress = {
  tags: ['jobs'],
  summary: 'Get job progress',
  description: 'Get detailed progress for a specific job run including items processed and estimated time remaining.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const, format: 'uuid', description: 'Job run ID' },
    },
    required: ['jobId'] as string[],
  },
  response: {
    200: { $ref: 'JobProgress#' },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Job run not found' },
      },
    },
  },
}

const streamJobProgress = {
  tags: ['jobs'],
  summary: 'Stream job progress (SSE)',
  description: 'Server-Sent Events stream for real-time job progress updates. Connect to this endpoint to receive progress updates as they happen.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const, format: 'uuid', description: 'Job run ID to stream progress for' },
    },
    required: ['jobId'] as string[],
  },
  response: {
    200: {
      description: 'SSE stream of JobProgress events',
      type: 'string' as const,
    },
  },
}

const getActiveJobs = {
  tags: ['jobs'],
  summary: 'Get active jobs',
  description: 'Get all currently running jobs with their progress.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        jobs: { type: 'array' as const, items: { $ref: 'JobProgress#' } },
      },
    },
  },
}

// =============================================================================
// Job History Schemas
// =============================================================================

const getJobHistory = {
  tags: ['jobs'],
  summary: 'Get job run history',
  description: 'Get run history for all jobs, sorted by most recent first.',
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const, description: 'Maximum runs to return', default: '50', example: '100' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        runs: { type: 'array' as const, items: { $ref: 'JobRun#' } },
      },
    },
  },
}

const getJobHistoryByName = {
  tags: ['jobs'],
  summary: 'Get job history by name',
  description: 'Get run history for a specific job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name', example: 'sync-movies' },
    },
    required: ['name'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const, description: 'Maximum runs to return', default: '20', example: '50' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        runs: { type: 'array' as const, items: { $ref: 'JobRun#' } },
      },
    },
  },
}

const getLastRuns = {
  tags: ['jobs'],
  summary: 'Get last run for each job',
  description: 'Get the most recent run for each job type. Useful for dashboard status display.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        runs: { 
          type: 'object' as const, 
          additionalProperties: { $ref: 'JobRun#' },
          description: 'Map of job name to last run',
        },
      },
    },
  },
}

// =============================================================================
// Scheduler Schemas
// =============================================================================

const getSchedulerStatus = {
  tags: ['jobs'],
  summary: 'Get scheduler status',
  description: 'Get current scheduler status showing which jobs are scheduled and their next run times.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        isRunning: { type: 'boolean' as const, description: 'Whether the scheduler is running' },
        scheduledJobs: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
              nextRunAt: { type: 'string' as const, format: 'date-time', nullable: true },
              scheduleDescription: { type: 'string' as const, description: 'Human-readable schedule' },
            },
          },
        },
      },
    },
  },
}

// =============================================================================
// Enrichment Schemas
// =============================================================================

const getEnrichmentStatus = {
  tags: ['jobs'],
  summary: 'Get enrichment status',
  description: 'Check if there are incomplete or interrupted enrichment runs. These can occur if the server was restarted during enrichment.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        hasInterrupted: { type: 'boolean' as const, description: 'Whether there are interrupted runs' },
        interruptedRuns: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              jobName: { type: 'string' as const },
              startedAt: { type: 'string' as const, format: 'date-time' },
              itemsProcessed: { type: 'integer' as const },
              itemsTotal: { type: 'integer' as const },
            },
          },
        },
      },
    },
  },
}

const clearInterrupted = {
  tags: ['jobs'],
  summary: 'Clear interrupted enrichment',
  description: 'Acknowledge and clear an interrupted enrichment run. The enrichment will resume from where it left off on the next run.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const, example: 'Interrupted run cleared' },
      },
    },
  },
}

// =============================================================================
// Database Purge Schemas
// =============================================================================

const getPurgeStats = {
  tags: ['admin'],
  summary: 'Get database purge statistics',
  description: 'Get current database statistics before performing a purge. Shows counts of movies, series, embeddings, etc.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        movies: { type: 'integer' as const, description: 'Number of movies' },
        series: { type: 'integer' as const, description: 'Number of series' },
        episodes: { type: 'integer' as const, description: 'Number of episodes' },
        embeddings: { type: 'integer' as const, description: 'Number of embeddings' },
        recommendations: { type: 'integer' as const, description: 'Number of recommendation runs' },
        watchHistory: { type: 'integer' as const, description: 'Number of watch history entries' },
      },
    },
  },
}

const purgeMovies = {
  tags: ['admin'],
  summary: 'Purge movie database',
  description: 'Permanently delete all movie-related data including movies, embeddings, recommendations, and watch history. This action cannot be undone. Requires explicit confirmation.',
  body: {
    type: 'object' as const,
    required: ['confirm'] as string[],
    properties: {
      confirm: { type: 'boolean' as const, description: 'Must be true to confirm the purge' },
    },
    example: {
      confirm: true,
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const, example: 'Movie data purged' },
        deleted: {
          type: 'object' as const,
          properties: {
            movies: { type: 'integer' as const },
            embeddings: { type: 'integer' as const },
            recommendations: { type: 'integer' as const },
          },
        },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Confirmation required' },
      },
    },
  },
}

// =============================================================================
// Export all schemas
// =============================================================================

export const jobSchemas = {
  listJobs,
  getJob,
  runJob,
  cancelJob,
  getJobConfig,
  updateJobConfig,
  getJobProgress,
  streamJobProgress,
  getActiveJobs,
  getJobHistory,
  getJobHistoryByName,
  getLastRuns,
  getSchedulerStatus,
  getEnrichmentStatus,
  clearInterrupted,
  getPurgeStats,
  purgeMovies,
}
