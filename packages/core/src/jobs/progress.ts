import { createChildLogger } from '../lib/logger.js'
import { query } from '../lib/db.js'
import { EventEmitter } from 'events'

const logger = createChildLogger('job-progress')

export interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
  currentStep: string
  currentStepIndex: number
  totalSteps: number
  stepProgress: number // 0-100 for current step
  overallProgress: number // 0-100 overall
  itemsProcessed: number
  itemsTotal: number
  currentItem?: string
  logs: LogEntry[]
  error?: string
  result?: Record<string, unknown>
}

export interface LogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, unknown>
}

// In-memory store for active jobs
const activeJobs = new Map<string, JobProgress>()
const jobEmitter = new EventEmitter()

// Increase max listeners for many concurrent subscribers
jobEmitter.setMaxListeners(100)

/**
 * Create a new job progress tracker
 */
export function createJobProgress(jobId: string, jobName: string, totalSteps: number): JobProgress {
  const progress: JobProgress = {
    jobId,
    jobName,
    status: 'running',
    startedAt: new Date(),
    currentStep: 'Initializing',
    currentStepIndex: 0,
    totalSteps,
    stepProgress: 0,
    overallProgress: 0,
    itemsProcessed: 0,
    itemsTotal: 0,
    logs: [],
  }

  activeJobs.set(jobId, progress)
  emitProgress(jobId, progress)
  
  logger.info({ jobId, jobName }, `Job started: ${jobName}`)
  addLog(jobId, 'info', `🚀 Starting job: ${jobName}`)

  return progress
}

/**
 * Update job step
 */
export function setJobStep(jobId: string, stepIndex: number, stepName: string, itemsTotal = 0): void {
  const progress = activeJobs.get(jobId)
  if (!progress) return

  progress.currentStepIndex = stepIndex
  progress.currentStep = stepName
  progress.stepProgress = 0
  progress.itemsProcessed = 0
  progress.itemsTotal = itemsTotal
  progress.currentItem = undefined

  // Calculate overall progress based on steps
  progress.overallProgress = Math.round((stepIndex / progress.totalSteps) * 100)

  emitProgress(jobId, progress)
  addLog(jobId, 'info', `📍 Step ${stepIndex + 1}/${progress.totalSteps}: ${stepName}`)
}

/**
 * Update item progress within a step
 */
export function updateJobProgress(
  jobId: string,
  itemsProcessed: number,
  itemsTotal?: number,
  currentItem?: string
): void {
  const progress = activeJobs.get(jobId)
  if (!progress) return

  progress.itemsProcessed = itemsProcessed
  if (itemsTotal !== undefined) {
    progress.itemsTotal = itemsTotal
  }
  if (currentItem !== undefined) {
    progress.currentItem = currentItem
  }

  // Calculate step progress
  if (progress.itemsTotal > 0) {
    progress.stepProgress = Math.round((itemsProcessed / progress.itemsTotal) * 100)
  }

  // Calculate overall progress (step progress contributes to overall)
  const stepContribution = 100 / progress.totalSteps
  const stepProgressContribution = (progress.stepProgress / 100) * stepContribution
  progress.overallProgress = Math.round(
    (progress.currentStepIndex / progress.totalSteps) * 100 + stepProgressContribution
  )

  emitProgress(jobId, progress)
}

/**
 * Add a log entry
 */
export function addLog(
  jobId: string,
  level: LogEntry['level'],
  message: string,
  data?: Record<string, unknown>
): void {
  const progress = activeJobs.get(jobId)
  if (!progress) return

  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data,
  }

  progress.logs.push(entry)

  // Keep only last 500 logs to prevent memory issues
  if (progress.logs.length > 500) {
    progress.logs = progress.logs.slice(-500)
  }

  // Also log to console
  const logFn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info
  logFn.call(logger, { jobId, ...data }, message)

  emitProgress(jobId, progress)
}

/**
 * Complete a job successfully
 */
export function completeJob(jobId: string, result?: Record<string, unknown>): void {
  const progress = activeJobs.get(jobId)
  if (!progress) return

  progress.status = 'completed'
  progress.completedAt = new Date()
  progress.overallProgress = 100
  progress.stepProgress = 100
  progress.result = result

  const duration = progress.completedAt.getTime() - progress.startedAt.getTime()
  addLog(jobId, 'info', `✅ Job completed in ${(duration / 1000).toFixed(1)}s`, result)

  emitProgress(jobId, progress)

  // Save to database
  saveJobRun(progress).catch((err) => {
    logger.error({ err, jobId }, 'Failed to save job run to database')
  })

  // Keep completed jobs for 5 minutes for UI to fetch results
  setTimeout(() => {
    activeJobs.delete(jobId)
  }, 5 * 60 * 1000)
}

/**
 * Fail a job
 */
export function failJob(jobId: string, error: string): void {
  const progress = activeJobs.get(jobId)
  if (!progress) return

  progress.status = 'failed'
  progress.completedAt = new Date()
  progress.error = error

  addLog(jobId, 'error', `❌ Job failed: ${error}`)

  emitProgress(jobId, progress)

  // Save to database
  saveJobRun(progress).catch((err) => {
    logger.error({ err, jobId }, 'Failed to save job run to database')
  })

  // Keep failed jobs for 10 minutes
  setTimeout(() => {
    activeJobs.delete(jobId)
  }, 10 * 60 * 1000)
}

/**
 * Cancel a running job
 */
export function cancelJob(jobId: string): boolean {
  const progress = activeJobs.get(jobId)
  if (!progress) return false
  if (progress.status !== 'running') return false

  progress.status = 'cancelled'
  progress.completedAt = new Date()

  const duration = progress.completedAt.getTime() - progress.startedAt.getTime()
  addLog(jobId, 'warn', `🛑 Job cancelled after ${(duration / 1000).toFixed(1)}s`)

  emitProgress(jobId, progress)

  // Save to database
  saveJobRun(progress).catch((err) => {
    logger.error({ err, jobId }, 'Failed to save job run to database')
  })

  // Keep cancelled jobs for 5 minutes
  setTimeout(() => {
    activeJobs.delete(jobId)
  }, 5 * 60 * 1000)

  return true
}

/**
 * Check if a job has been cancelled
 * Jobs can call this periodically to gracefully exit
 */
export function isJobCancelled(jobId: string): boolean {
  const progress = activeJobs.get(jobId)
  return progress?.status === 'cancelled'
}

/**
 * Get current job progress
 */
export function getJobProgress(jobId: string): JobProgress | undefined {
  return activeJobs.get(jobId)
}

/**
 * Get all active jobs
 */
export function getAllJobProgress(): JobProgress[] {
  return Array.from(activeJobs.values())
}

/**
 * Subscribe to job progress updates
 */
export function subscribeToJob(jobId: string, callback: (progress: JobProgress) => void): () => void {
  const handler = (progress: JobProgress) => {
    if (progress.jobId === jobId) {
      callback(progress)
    }
  }

  jobEmitter.on('progress', handler)

  // Return unsubscribe function
  return () => {
    jobEmitter.off('progress', handler)
  }
}

/**
 * Subscribe to all job updates
 */
export function subscribeToAllJobs(callback: (progress: JobProgress) => void): () => void {
  jobEmitter.on('progress', callback)
  return () => {
    jobEmitter.off('progress', callback)
  }
}

function emitProgress(jobId: string, progress: JobProgress): void {
  jobEmitter.emit('progress', { ...progress })
}

/**
 * Helper to create a progress-aware async iterator
 */
export async function* withProgress<T>(
  jobId: string,
  items: T[],
  getLabel: (item: T) => string
): AsyncGenerator<{ item: T; index: number }> {
  const total = items.length
  updateJobProgress(jobId, 0, total)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    updateJobProgress(jobId, i, total, getLabel(item))
    yield { item, index: i }
    updateJobProgress(jobId, i + 1, total)
  }
}

// ===== Database persistence for job runs =====

export interface JobRunRecord {
  id: string
  job_name: string
  status: 'completed' | 'failed' | 'cancelled'
  started_at: Date
  completed_at: Date
  duration_ms: number
  items_processed: number
  items_total: number
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: Date
}

/**
 * Save a job run to the database
 */
async function saveJobRun(progress: JobProgress): Promise<void> {
  const completedAt = progress.completedAt || new Date()
  const durationMs = completedAt.getTime() - progress.startedAt.getTime()

  // Insert into job_runs table
  await query(
    `INSERT INTO job_runs (job_name, status, started_at, completed_at, duration_ms, items_processed, items_total, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      progress.jobName,
      progress.status,
      progress.startedAt,
      completedAt,
      durationMs,
      progress.itemsProcessed,
      progress.itemsTotal,
      progress.error || null,
      JSON.stringify(progress.result || {}),
    ]
  )

  // Update job_config with last run info
  await query(
    `UPDATE job_config
     SET last_run_at = $1, last_run_status = $2, last_run_duration_ms = $3, updated_at = NOW()
     WHERE job_name = $4`,
    [completedAt, progress.status, durationMs, progress.jobName]
  )

  logger.info({ jobName: progress.jobName, status: progress.status, durationMs }, 'Job run saved to database')
}

/**
 * Get job run history from database
 */
export async function getJobRunHistory(
  jobName?: string,
  limit = 50
): Promise<JobRunRecord[]> {
  let sql = `
    SELECT id, job_name, status, started_at, completed_at, duration_ms, 
           items_processed, items_total, error_message, metadata, created_at
    FROM job_runs
  `
  const params: unknown[] = []

  if (jobName) {
    sql += ` WHERE job_name = $1`
    params.push(jobName)
  }

  sql += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await query<JobRunRecord>(sql, params)
  return result.rows
}

/**
 * Get the last run for each job type
 */
export async function getLastJobRuns(): Promise<Map<string, JobRunRecord>> {
  const result = await query<JobRunRecord>(`
    SELECT DISTINCT ON (job_name) 
           id, job_name, status, started_at, completed_at, duration_ms,
           items_processed, items_total, error_message, metadata, created_at
    FROM job_runs
    ORDER BY job_name, started_at DESC
  `)

  const map = new Map<string, JobRunRecord>()
  for (const row of result.rows) {
    map.set(row.job_name, row)
  }
  return map
}

