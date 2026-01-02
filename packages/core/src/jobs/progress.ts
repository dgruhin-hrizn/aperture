import { createChildLogger } from '../lib/logger.js'
import { EventEmitter } from 'events'

const logger = createChildLogger('job-progress')

export interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
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

  // Keep failed jobs for 10 minutes
  setTimeout(() => {
    activeJobs.delete(jobId)
  }, 10 * 60 * 1000)
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

