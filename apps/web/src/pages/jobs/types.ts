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
}

export interface JobCategory {
  title: string
  description: string
  color: string
  jobs: string[]
}

