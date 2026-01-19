/**
 * Jobs TypeScript Interfaces
 */

export interface JobInfo {
  name: string
  description: string
  cron: string | null
  lastRun: Date | null
  status: 'idle' | 'running' | 'failed'
  currentJobId?: string
  manualOnly?: boolean
}

export interface JobDefinition {
  name: string
  description: string
  cron: string | null
  manualOnly?: boolean
}

export interface JobProgress {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentStep: string
  overallProgress: number
  itemsProcessed: number
  itemsTotal: number
  logs: Array<{ timestamp: Date; level: string; message: string }>
  result?: Record<string, unknown>
}

export interface JobConfigUpdate {
  scheduleType?: 'daily' | 'weekly' | 'interval' | 'manual'
  scheduleHour?: number | null
  scheduleMinute?: number | null
  scheduleDayOfWeek?: number | null
  scheduleIntervalHours?: number | null
  isEnabled?: boolean
}
