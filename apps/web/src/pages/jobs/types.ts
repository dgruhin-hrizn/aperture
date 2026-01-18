export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, unknown>
}

export type ScheduleType = 'daily' | 'weekly' | 'interval' | 'manual'

export interface JobSchedule {
  type: ScheduleType
  hour: number | null
  minute: number | null
  dayOfWeek: number | null
  intervalHours: number | null
  isEnabled: boolean
  formatted: string
}

export interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: string
  currentStepIndex: number
  totalSteps: number
  stepProgress: number
  overallProgress: number
  itemsProcessed: number
  itemsTotal: number
  currentItem?: string
  logs: LogEntry[]
  error?: string
  result?: Record<string, unknown>
}

export interface JobLastRun {
  id: string
  status: 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt: string
  durationMs: number
  itemsProcessed: number
  itemsTotal: number
  errorMessage: string | null
}

export interface JobRunRecord {
  id: string
  job_name: string
  status: 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at: string
  duration_ms: number
  items_processed: number
  items_total: number
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Job {
  name: string
  description: string
  cron: string | null
  status: 'idle' | 'running' | 'failed'
  currentJobId?: string
  progress?: {
    overallProgress: number
    currentStep: string
    itemsProcessed: number
    itemsTotal: number
  }
  schedule?: JobSchedule | null
  lastRun?: JobLastRun | null
  manualOnly?: boolean
}

export interface JobCategory {
  title: string
  description: string
  color: string
  jobs: string[]
}

