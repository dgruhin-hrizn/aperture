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
  /** 15 or 30 when set; mutually exclusive with scheduleIntervalHours for interval schedules */
  scheduleIntervalMinutes: number | null
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
  schedule_interval_minutes: number | null
  is_enabled: boolean
  updated_at: Date
}

// Default schedules (configurable via Admin → Jobs)
// Jobs at same intervals are staggered by minute offset to avoid resource contention
const ENV_DEFAULTS: Record<
  string,
  {
    scheduleType: ScheduleType
    hour: number
    minute: number
    intervalHours?: number
    intervalMinutes?: number
    dayOfWeek?: number
  }
> = {
  // === EVERY 30 MINUTES ===
  'sync-users': { scheduleType: 'interval', hour: 0, minute: 0, intervalMinutes: 30 },

  // === EVERY HOUR (offset from catalog scans and user sync) ===
  'sync-series-watch-history': { scheduleType: 'interval', hour: 0, minute: 5, intervalHours: 1 },
  'sync-watching-favorites': { scheduleType: 'interval', hour: 0, minute: 45, intervalHours: 1 },

  // === EVERY 2 HOURS ===
  'sync-movie-watch-history': { scheduleType: 'interval', hour: 0, minute: 15, intervalHours: 2 },

  // === EVERY 3 HOURS (staggered by 10 mins) ===
  'sync-movies': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 3 },
  'sync-series': { scheduleType: 'interval', hour: 0, minute: 10, intervalHours: 3 },
  'sync-movie-libraries': { scheduleType: 'interval', hour: 0, minute: 20, intervalHours: 3 },
  'sync-series-libraries': { scheduleType: 'interval', hour: 0, minute: 30, intervalHours: 3 },

  // === EVERY 6 HOURS (staggered by 10 mins) ===
  'enrich-metadata': { scheduleType: 'interval', hour: 0, minute: 0, intervalHours: 6 },
  'generate-movie-embeddings': { scheduleType: 'interval', hour: 0, minute: 10, intervalHours: 6 },
  'generate-series-embeddings': { scheduleType: 'interval', hour: 0, minute: 20, intervalHours: 6 },
  'sync-trakt-ratings': { scheduleType: 'interval', hour: 0, minute: 30, intervalHours: 6 },

  // === DAILY ===
  'backup-database': { scheduleType: 'daily', hour: 2, minute: 0 },
  'refresh-top-picks': { scheduleType: 'daily', hour: 5, minute: 0 },
  'enrich-studio-logos': { scheduleType: 'daily', hour: 5, minute: 30 },
  'enrich-mdblist': { scheduleType: 'daily', hour: 7, minute: 0 },
  'generate-discovery-suggestions': { scheduleType: 'daily', hour: 6, minute: 0 },

  // === WEEKLY (Sunday) ===
  'refresh-assistant-suggestions': { scheduleType: 'weekly', hour: 0, minute: 0, dayOfWeek: 0 },
  'generate-movie-recommendations': { scheduleType: 'weekly', hour: 4, minute: 0, dayOfWeek: 0 },
  'generate-series-recommendations': { scheduleType: 'weekly', hour: 4, minute: 0, dayOfWeek: 0 },
  'refresh-ai-pricing': { scheduleType: 'weekly', hour: 0, minute: 0, dayOfWeek: 0 },
  'auto-request-top-picks': { scheduleType: 'weekly', hour: 0, minute: 0, dayOfWeek: 0 },

  // === MANUAL ONLY ===
  'full-reset-movie-recommendations': { scheduleType: 'manual', hour: 0, minute: 0 },
  'full-reset-series-recommendations': { scheduleType: 'manual', hour: 0, minute: 0 },
  'refresh-library-gaps': { scheduleType: 'manual', hour: 0, minute: 0 },
}

function rowToConfig(row: JobConfigRow): JobConfig {
  return {
    jobName: row.job_name,
    scheduleType: row.schedule_type as ScheduleType,
    scheduleHour: row.schedule_hour,
    scheduleMinute: row.schedule_minute ?? (row.schedule_type === 'interval' ? ENV_DEFAULTS[row.job_name]?.minute ?? 0 : 0),
    scheduleDayOfWeek: row.schedule_day_of_week,
    scheduleIntervalHours: row.schedule_interval_hours,
    scheduleIntervalMinutes: row.schedule_interval_minutes,
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
            schedule_day_of_week, schedule_interval_hours, schedule_interval_minutes, is_enabled, updated_at
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
    return {
      jobName,
      scheduleType: defaultConfig.scheduleType,
      scheduleHour: defaultConfig.hour,
      scheduleMinute: defaultConfig.minute,
      scheduleDayOfWeek: defaultConfig.dayOfWeek ?? null,
      scheduleIntervalHours: defaultConfig.intervalHours ?? null,
      scheduleIntervalMinutes: defaultConfig.intervalMinutes ?? null,
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
            schedule_day_of_week, schedule_interval_hours, schedule_interval_minutes, is_enabled, updated_at
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
    scheduleIntervalMinutes?: number | null
    isEnabled?: boolean
  }
): Promise<JobConfig> {
  const defaults = ENV_DEFAULTS[jobName]
  const type = config.scheduleType ?? defaults?.scheduleType ?? 'daily'
  const hours = config.scheduleIntervalMinutes != null ? null
    : config.scheduleIntervalHours !== undefined ? config.scheduleIntervalHours : defaults?.intervalHours ?? null
  const minutes = config.scheduleIntervalHours != null ? null
    : config.scheduleIntervalMinutes !== undefined ? config.scheduleIntervalMinutes : defaults?.intervalMinutes ?? null
  const result = await queryOne<JobConfigRow>(
    `INSERT INTO job_config (job_name, schedule_type, schedule_hour, schedule_minute,
                             schedule_day_of_week, schedule_interval_hours, schedule_interval_minutes, is_enabled)
     VALUES ($1, $2, CASE WHEN $2 IN ('interval','manual') THEN NULL ELSE $3::integer END, $4,
             CASE WHEN $2 = 'weekly' THEN $5::integer ELSE NULL END,
             CASE WHEN $2 = 'interval' THEN $6::integer ELSE NULL END,
             CASE WHEN $2 = 'interval' THEN $7::integer ELSE NULL END, $8)
     ON CONFLICT (job_name) DO UPDATE SET
       schedule_type = CASE WHEN $9 THEN EXCLUDED.schedule_type ELSE job_config.schedule_type END,
       schedule_hour = CASE WHEN $10 THEN $3 WHEN $9 AND EXCLUDED.schedule_type IN ('interval','manual')
         THEN NULL ELSE job_config.schedule_hour END,
       schedule_minute = CASE WHEN $11 THEN EXCLUDED.schedule_minute ELSE job_config.schedule_minute END,
       schedule_day_of_week = CASE WHEN $12 THEN $5 WHEN $9 AND EXCLUDED.schedule_type <> 'weekly'
         THEN NULL ELSE job_config.schedule_day_of_week END,
       schedule_interval_hours = CASE WHEN $9 AND EXCLUDED.schedule_type <> 'interval' THEN NULL
         WHEN $13 OR ($14 AND $7 IS NOT NULL) THEN $6 ELSE job_config.schedule_interval_hours END,
       schedule_interval_minutes = CASE WHEN $9 AND EXCLUDED.schedule_type <> 'interval' THEN NULL
         WHEN $14 OR ($13 AND $6 IS NOT NULL) THEN $7 ELSE job_config.schedule_interval_minutes END,
       is_enabled = CASE WHEN $15 THEN EXCLUDED.is_enabled ELSE job_config.is_enabled END,
       updated_at = NOW()
     RETURNING job_name, schedule_type, schedule_hour, schedule_minute,
               schedule_day_of_week, schedule_interval_hours, schedule_interval_minutes, is_enabled, updated_at`,
    [
      jobName, type,
      config.scheduleHour !== undefined ? config.scheduleHour : defaults?.hour ?? 0,
      config.scheduleMinute !== undefined ? config.scheduleMinute : defaults?.minute ?? 0,
      config.scheduleDayOfWeek !== undefined ? config.scheduleDayOfWeek : defaults?.dayOfWeek ?? 0,
      hours,
      minutes,
      config.isEnabled ?? true,
      config.scheduleType !== undefined, config.scheduleHour !== undefined,
      config.scheduleMinute !== undefined, config.scheduleDayOfWeek !== undefined,
      config.scheduleIntervalHours !== undefined, config.scheduleIntervalMinutes !== undefined,
      config.isEnabled !== undefined,
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
      const intervalMins = config.scheduleIntervalMinutes
      if (intervalMins === 15) {
        return '*/15 * * * *'
      }
      if (intervalMins === 30) {
        return '*/30 * * * *'
      }
      const intervalHours = config.scheduleIntervalHours ?? 1
      // Use minute offset for staggering jobs at the same interval
      return `${minute} */${intervalHours} * * *`
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
      const intervalMins = config.scheduleIntervalMinutes
      if (intervalMins === 15) {
        return 'Every 15 minutes'
      }
      if (intervalMins === 30) {
        return 'Every 30 minutes'
      }
      const hours = config.scheduleIntervalHours ?? 1
      // Show minute offset if non-zero (for staggered jobs)
      if (minute > 0) {
        return hours === 1 ? `Every hour at :${minute.toString().padStart(2, '0')}` : `Every ${hours} hours at :${minute.toString().padStart(2, '0')}`
      }
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
