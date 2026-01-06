/**
 * Job Scheduler Service
 * 
 * Uses node-cron to automatically run jobs based on their configured schedules.
 * Schedules are stored in the database and can be modified via the admin UI.
 */

import cron, { ScheduledTask } from 'node-cron'
import { createChildLogger } from './logger.js'
import {
  getAllJobConfigs,
  scheduleToCron,
  formatSchedule,
  type JobConfig,
} from '@aperture/core'

const logger = createChildLogger('scheduler')

// Track active cron tasks with their cron expressions
interface ScheduledJob {
  task: ScheduledTask
  cronExpression: string
  schedule: string // Human-readable
}
const scheduledTasks: Map<string, ScheduledJob> = new Map()

// Job execution function - will be set by the jobs routes
let jobExecutor: ((jobName: string) => Promise<void>) | null = null

/**
 * Set the job executor function (called from jobs routes)
 */
export function setJobExecutor(executor: (jobName: string) => Promise<void>): void {
  jobExecutor = executor
}

/**
 * Schedule a single job based on its configuration
 */
function scheduleJob(config: JobConfig): void {
  const cronExpression = scheduleToCron(config)
  const humanSchedule = formatSchedule(config)
  
  // Stop existing task if any
  const existingJob = scheduledTasks.get(config.jobName)
  if (existingJob) {
    existingJob.task.stop()
    scheduledTasks.delete(config.jobName)
  }

  // Don't schedule if manual only, disabled, or no cron expression
  if (!cronExpression) {
    logger.debug({ job: config.jobName, reason: config.scheduleType }, 'Job not scheduled (manual/disabled)')
    return
  }

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    logger.error({ job: config.jobName, cron: cronExpression }, 'Invalid cron expression')
    return
  }

  // Create scheduled task
  const task = cron.schedule(cronExpression, async () => {
    logger.info({ job: config.jobName, schedule: humanSchedule }, `⏰ Scheduled job starting: ${config.jobName}`)
    
    if (!jobExecutor) {
      logger.error({ job: config.jobName }, 'Job executor not set - cannot run scheduled job')
      return
    }

    try {
      await jobExecutor(config.jobName)
      logger.info({ job: config.jobName }, `✅ Scheduled job completed: ${config.jobName}`)
    } catch (err) {
      logger.error({ err, job: config.jobName }, `❌ Scheduled job failed: ${config.jobName}`)
    }
  }, {
    timezone: process.env.TZ || 'America/New_York',
    scheduled: true,
  })

  scheduledTasks.set(config.jobName, {
    task,
    cronExpression,
    schedule: humanSchedule,
  })
  logger.info({ job: config.jobName, cron: cronExpression, schedule: humanSchedule }, `📅 Job scheduled: ${config.jobName} (${humanSchedule})`)
}

/**
 * Initialize the scheduler with all job configurations
 */
export async function initializeScheduler(): Promise<void> {
  logger.info('🚀 Initializing job scheduler...')

  try {
    const configs = await getAllJobConfigs()
    
    let scheduled = 0
    let manual = 0
    let disabled = 0

    for (const config of configs) {
      if (!config.isEnabled) {
        disabled++
        continue
      }
      if (config.scheduleType === 'manual') {
        manual++
        continue
      }
      
      scheduleJob(config)
      scheduled++
    }

    logger.info(
      { scheduled, manual, disabled, total: configs.length },
      `📅 Scheduler initialized: ${scheduled} scheduled, ${manual} manual-only, ${disabled} disabled`
    )
  } catch (err) {
    logger.error({ err }, 'Failed to initialize scheduler')
    throw err
  }
}

/**
 * Refresh a single job's schedule (call after config update)
 */
export async function refreshJobSchedule(jobName: string): Promise<void> {
  const configs = await getAllJobConfigs()
  const config = configs.find(c => c.jobName === jobName)
  
  if (!config) {
    // Job doesn't exist, stop any existing task
    const existingJob = scheduledTasks.get(jobName)
    if (existingJob) {
      existingJob.task.stop()
      scheduledTasks.delete(jobName)
    }
    return
  }

  scheduleJob(config)
  logger.info({ job: jobName }, `🔄 Job schedule refreshed: ${jobName}`)
}

/**
 * Refresh all job schedules (call after bulk config changes)
 */
export async function refreshAllSchedules(): Promise<void> {
  logger.info('🔄 Refreshing all job schedules...')
  
  // Stop all existing tasks
  for (const [jobName, job] of scheduledTasks) {
    job.task.stop()
    scheduledTasks.delete(jobName)
  }

  // Re-initialize
  await initializeScheduler()
}

/**
 * Stop the scheduler (for graceful shutdown)
 */
export function stopScheduler(): void {
  logger.info('🛑 Stopping job scheduler...')
  
  for (const [jobName, job] of scheduledTasks) {
    job.task.stop()
    logger.debug({ job: jobName }, 'Stopped scheduled task')
  }
  
  scheduledTasks.clear()
  logger.info('✅ Scheduler stopped')
}

/**
 * Get scheduler status for monitoring
 */
export function getSchedulerStatus(): {
  isRunning: boolean
  scheduledJobs: Array<{ jobName: string; cronExpression: string; schedule: string }>
} {
  const scheduledJobs = Array.from(scheduledTasks.entries()).map(([jobName, job]) => ({
    jobName,
    cronExpression: job.cronExpression,
    schedule: job.schedule,
  }))

  return {
    isRunning: scheduledTasks.size > 0,
    scheduledJobs,
  }
}

