/**
 * Jobs OpenAPI Schemas
 */

// =============================================================================
// Job List & Status Schemas
// =============================================================================

const listJobs = {
  tags: ['jobs'],
  summary: 'List all jobs',
  description: 'Get all jobs with their status, schedule configuration, and last run info.',
}

const getJob = {
  tags: ['jobs'],
  summary: 'Get job details',
  description: 'Get details for a specific job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
}

const runJob = {
  tags: ['jobs'],
  summary: 'Run job',
  description: 'Trigger a job to run manually.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
}

const cancelJob = {
  tags: ['jobs'],
  summary: 'Cancel job',
  description: 'Cancel a running job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
}

// =============================================================================
// Job Configuration Schemas
// =============================================================================

const getJobConfig = {
  tags: ['jobs'],
  summary: 'Get job configuration',
  description: 'Get schedule configuration for a specific job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
}

const updateJobConfig = {
  tags: ['jobs'],
  summary: 'Update job configuration',
  description: 'Update schedule configuration for a specific job.',
  params: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
  body: {
    type: 'object' as const,
    properties: {
      scheduleType: {
        type: 'string' as const,
        enum: ['daily', 'weekly', 'interval', 'manual'],
      },
      scheduleHour: { type: 'number' as const, nullable: true },
      scheduleMinute: { type: 'number' as const, nullable: true },
      scheduleDayOfWeek: { type: 'number' as const, nullable: true },
      scheduleIntervalHours: { type: 'number' as const, nullable: true },
      isEnabled: { type: 'boolean' as const },
    },
  },
}

// =============================================================================
// Job Progress Schemas
// =============================================================================

const getJobProgress = {
  tags: ['jobs'],
  summary: 'Get job progress',
  description: 'Get detailed progress for a specific job run.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const, description: 'Job run ID' },
    },
    required: ['jobId'] as string[],
  },
}

const streamJobProgress = {
  tags: ['jobs'],
  summary: 'Stream job progress',
  description: 'Server-Sent Events stream for real-time job progress.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const, description: 'Job run ID' },
    },
    required: ['jobId'] as string[],
  },
}

const getActiveJobs = {
  tags: ['jobs'],
  summary: 'Get active jobs',
  description: 'Get all currently running jobs.',
}

// =============================================================================
// Job History Schemas
// =============================================================================

const getJobHistory = {
  tags: ['jobs'],
  summary: 'Get job history',
  description: 'Get run history for all jobs.',
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const },
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
      name: { type: 'string' as const, description: 'Job name' },
    },
    required: ['name'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const },
    },
  },
}

const getLastRuns = {
  tags: ['jobs'],
  summary: 'Get last job runs',
  description: 'Get the last run for each job type.',
}

// =============================================================================
// Scheduler Schemas
// =============================================================================

const getSchedulerStatus = {
  tags: ['jobs'],
  summary: 'Get scheduler status',
  description: 'Get current scheduler status (which jobs are scheduled).',
}

// =============================================================================
// Enrichment Schemas
// =============================================================================

const getEnrichmentStatus = {
  tags: ['jobs'],
  summary: 'Get enrichment status',
  description: 'Get enrichment run status - detects incomplete/interrupted runs.',
}

const clearInterrupted = {
  tags: ['jobs'],
  summary: 'Clear interrupted enrichment',
  description: 'Clear/acknowledge an interrupted enrichment run.',
}

// =============================================================================
// Database Purge Schemas
// =============================================================================

const getPurgeStats = {
  tags: ['admin'],
  summary: 'Get purge stats',
  description: 'Get current database stats before purge.',
}

const purgeMovies = {
  tags: ['admin'],
  summary: 'Purge movie database',
  description: 'Purge all movie-related data (requires confirmation).',
  body: {
    type: 'object' as const,
    properties: {
      confirm: { type: 'boolean' as const },
    },
    required: ['confirm'] as string[],
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
