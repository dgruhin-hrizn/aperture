import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('job-config')

export type ScheduleType = 'daily' | 'weekly' | 'interval' | 'manual'

export interface JobConfig {
  jobName: string
  scheduleType: ScheduleType
  scheduleHour: number | null
  scheduleMinute: number | null
  scheduleDayOfWeek: number | null
  scheduleIntervalHours: number | null
  isEnabled: boolean
  updatedAt: Date
}

interface JobConfigRow {
  job_name: string
  schedule_type: string
  schedule_hour: number | null
  schedule_minute: number | null
  schedule_day_of_week: number | null
  schedule_interval_hours: number | null
  is_enabled: boolean
  updated_at: Date
}

// Default schedules (configurable via Admin → Jobs)
const ENV_DEFAULTS: Record<
  string,
  {
    scheduleType: ScheduleType
    hour: number
    minute: number
    intervalHours?: number
    dayOfWeek?: number
  }
> = {
  // Movie jobs - Scan libraries daily at 2am
  'sync-movies': { scheduleType: 'daily', hour: 2, minute: 0 },
  // Watch history every 2 hours
  'sync-movie-watch-history': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 2 },
  'full-sync-movie-watch-history': { scheduleType: 'manual', hour: 0, minute: 0 },
  // Embeddings daily at 3am
  'generate-movie-embeddings': { scheduleType: 'daily', hour: 3, minute: 0 },
  // Recommendations weekly on Sunday at 4am
  'generate-movie-recommendations': { scheduleType: 'weekly', hour: 4, minute: 0, dayOfWeek: 0 },
  'rebuild-movie-recommendations': { scheduleType: 'manual', hour: 0, minute: 0 },
  // Library sync after recommendations (weekly Sunday at 5am)
  'sync-movie-libraries': { scheduleType: 'weekly', hour: 5, minute: 0, dayOfWeek: 0 },
  // Series jobs - Scan libraries daily at 2am
  'sync-series': { scheduleType: 'daily', hour: 2, minute: 0 },
  // Watch history every 2 hours
  'sync-series-watch-history': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 2 },
  'full-sync-series-watch-history': { scheduleType: 'manual', hour: 0, minute: 0 },
  // Embeddings daily at 3am
  'generate-series-embeddings': { scheduleType: 'daily', hour: 3, minute: 0 },
  // Recommendations weekly on Sunday at 4am
  'generate-series-recommendations': { scheduleType: 'weekly', hour: 4, minute: 0, dayOfWeek: 0 },
  // Library sync after recommendations (weekly Sunday at 5am)
  'sync-series-libraries': { scheduleType: 'weekly', hour: 5, minute: 0, dayOfWeek: 0 },
  // Top Picks job - daily at 5am
  'refresh-top-picks': { scheduleType: 'daily', hour: 5, minute: 0 },
  // Trakt sync job (every 6 hours)
  'sync-trakt-ratings': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 6 },
  // Watching libraries job (every 4 hours)
  'sync-watching-libraries': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 4 },
  // Assistant suggestions job (every hour)
  'refresh-assistant-suggestions': {
    scheduleType: 'interval',
    hour: 0,
    minute: 0,
    intervalHours: 1,
  },
  // Metadata enrichment job (every 6 hours)
  'enrich-metadata': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 6 },
  // Database backup job (daily at 1am)
  'backup-database': { scheduleType: 'daily', hour: 1, minute: 0 },
}

function rowToConfig(row: JobConfigRow): JobConfig {
  return {
    jobName: row.job_name,
    scheduleType: row.schedule_type as ScheduleType,
    scheduleHour: row.schedule_hour,
    scheduleMinute: row.schedule_minute,
    scheduleDayOfWeek: row.schedule_day_of_week,
    scheduleIntervalHours: row.schedule_interval_hours,
    isEnabled: row.is_enabled,
    updatedAt: row.updated_at,
  }
}

/**
 * Get job configuration from database, falling back to ENV defaults
 */
export async function getJobConfig(jobName: string): Promise<JobConfig | null> {
  const result = await queryOne<JobConfigRow>(
    `SELECT job_name, schedule_type, schedule_hour, schedule_minute,
            schedule_day_of_week, schedule_interval_hours, is_enabled, updated_at
     FROM job_config
     WHERE job_name = $1`,
    [jobName]
  )

  if (result) {
    return rowToConfig(result)
  }

  // Fall back to defaults if not in database
  const defaultConfig = ENV_DEFAULTS[jobName]
  if (defaultConfig) {
    const isTimeBasedSchedule =
      defaultConfig.scheduleType === 'daily' || defaultConfig.scheduleType === 'weekly'

    return {
      jobName,
      scheduleType: defaultConfig.scheduleType,
      scheduleHour: isTimeBasedSchedule ? defaultConfig.hour : null,
      scheduleMinute: isTimeBasedSchedule ? defaultConfig.minute : null,
      scheduleDayOfWeek: defaultConfig.dayOfWeek ?? null,
      scheduleIntervalHours: defaultConfig.intervalHours ?? null,
      isEnabled: true,
      updatedAt: new Date(),
    }
  }

  return null
}

/**
 * Get all job configurations
 */
export async function getAllJobConfigs(): Promise<JobConfig[]> {
  const result = await query<JobConfigRow>(
    `SELECT job_name, schedule_type, schedule_hour, schedule_minute,
            schedule_day_of_week, schedule_interval_hours, is_enabled, updated_at
     FROM job_config
     ORDER BY job_name`
  )

  const configs = result.rows.map(rowToConfig)

  // Add any missing jobs from ENV_DEFAULTS
  const existingNames = new Set(configs.map((c) => c.jobName))
  for (const jobName of Object.keys(ENV_DEFAULTS)) {
    if (!existingNames.has(jobName)) {
      const config = await getJobConfig(jobName)
      if (config) configs.push(config)
    }
  }

  return configs
}

/**
 * Update job configuration
 */
export async function setJobConfig(
  jobName: string,
  config: {
    scheduleType?: ScheduleType
    scheduleHour?: number | null
    scheduleMinute?: number | null
    scheduleDayOfWeek?: number | null
    scheduleIntervalHours?: number | null
    isEnabled?: boolean
  }
): Promise<JobConfig> {
  const result = await queryOne<JobConfigRow>(
    `INSERT INTO job_config (job_name, schedule_type, schedule_hour, schedule_minute,
                             schedule_day_of_week, schedule_interval_hours, is_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (job_name) DO UPDATE SET
       schedule_type = COALESCE($2, job_config.schedule_type),
       schedule_hour = CASE WHEN $2 IS NOT NULL THEN $3 ELSE job_config.schedule_hour END,
       schedule_minute = CASE WHEN $2 IS NOT NULL THEN $4 ELSE job_config.schedule_minute END,
       schedule_day_of_week = CASE WHEN $2 IS NOT NULL THEN $5 ELSE job_config.schedule_day_of_week END,
       schedule_interval_hours = CASE WHEN $2 IS NOT NULL THEN $6 ELSE job_config.schedule_interval_hours END,
       is_enabled = COALESCE($7, job_config.is_enabled),
       updated_at = NOW()
     RETURNING job_name, schedule_type, schedule_hour, schedule_minute,
               schedule_day_of_week, schedule_interval_hours, is_enabled, updated_at`,
    [
      jobName,
      config.scheduleType ?? 'daily',
      config.scheduleHour ?? null,
      config.scheduleMinute ?? null,
      config.scheduleDayOfWeek ?? null,
      config.scheduleIntervalHours ?? null,
      config.isEnabled ?? true,
    ]
  )

  if (!result) {
    throw new Error(`Failed to update job config for ${jobName}`)
  }

  logger.info({ jobName, config }, 'Job config updated')
  return rowToConfig(result)
}

/**
 * Convert schedule config to cron expression (for internal scheduler use)
 */
export function scheduleToCron(config: JobConfig): string | null {
  if (!config.isEnabled || config.scheduleType === 'manual') {
    return null
  }

  const minute = config.scheduleMinute ?? 0
  const hour = config.scheduleHour ?? 0

  switch (config.scheduleType) {
    case 'daily':
      return `${minute} ${hour} * * *`

    case 'weekly': {
      const dayOfWeek = config.scheduleDayOfWeek ?? 0
      return `${minute} ${hour} * * ${dayOfWeek}`
    }

    case 'interval': {
      const intervalHours = config.scheduleIntervalHours ?? 1
      return `0 */${intervalHours} * * *`
    }

    default:
      return null
  }
}

/**
 * Format schedule config to human-readable string
 */
export function formatSchedule(config: JobConfig): string {
  if (!config.isEnabled) {
    return 'Disabled'
  }

  if (config.scheduleType === 'manual') {
    return 'Manual only'
  }

  const formatTime = (hour: number, minute: number): string => {
    const h = hour % 12 || 12
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const m = minute.toString().padStart(2, '0')
    return `${h}:${m} ${ampm}`
  }

  const hour = config.scheduleHour ?? 0
  const minute = config.scheduleMinute ?? 0

  switch (config.scheduleType) {
    case 'daily':
      return `Daily at ${formatTime(hour, minute)}`

    case 'weekly': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = days[config.scheduleDayOfWeek ?? 0]
      return `Weekly on ${dayName} at ${formatTime(hour, minute)}`
    }

    case 'interval': {
      const hours = config.scheduleIntervalHours ?? 1
      return hours === 1 ? 'Every hour' : `Every ${hours} hours`
    }

    default:
      return 'Unknown schedule'
  }
}

/**
 * Get list of valid job names
 */
export function getValidJobNames(): string[] {
  return Object.keys(ENV_DEFAULTS)
}
