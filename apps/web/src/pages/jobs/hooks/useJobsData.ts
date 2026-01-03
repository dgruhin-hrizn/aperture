import { useEffect, useState, useRef, useCallback } from 'react'
import type { Job, JobProgress } from '../types'

export interface UseJobsDataReturn {
  jobs: Job[]
  loading: boolean
  error: string | null
  jobProgress: Map<string, JobProgress>
  expandedLogs: Set<string>
  cancelDialogJob: string | null
  cancellingJobs: Set<string>
  logsContainerRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  runningCount: number
  handleRunJob: (jobName: string) => Promise<void>
  handleCancelJob: (jobName: string) => Promise<void>
  toggleLogs: (jobName: string) => void
  setCancelDialogJob: (jobName: string | null) => void
}

export function useJobsData(): UseJobsDataReturn {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<Map<string, JobProgress>>(new Map())
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [cancelDialogJob, setCancelDialogJob] = useState<string | null>(null)
  const [cancellingJobs, setCancellingJobs] = useState<Set<string>>(new Set())
  const logsContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map())

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs)
        setError(null)
        return data.jobs as Job[]
      } else {
        setError('Failed to load jobs')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
    return []
  }, [])

  const connectToJobStream = useCallback(
    (jobName: string, jobId: string) => {
      const existing = eventSourceRefs.current.get(jobId)
      if (existing) {
        existing.close()
      }

      const eventSource = new EventSource(`/api/jobs/progress/stream/${jobId}`, {
        withCredentials: true,
      })

      eventSource.onmessage = (event) => {
        try {
          const progress = JSON.parse(event.data) as JobProgress
          setJobProgress((prev) => {
            const next = new Map(prev)
            next.set(jobName, progress)
            return next
          })

          // Auto-scroll logs
          setTimeout(() => {
            const container = logsContainerRefs.current.get(jobName)
            if (container) {
              container.scrollTop = container.scrollHeight
            }
          }, 100)

          // If job finished, refresh and clear progress after delay
          if (
            progress.status === 'completed' ||
            progress.status === 'failed' ||
            progress.status === 'cancelled'
          ) {
            setTimeout(() => {
              fetchJobs()
              setTimeout(() => {
                setJobProgress((prev) => {
                  const next = new Map(prev)
                  next.delete(jobName)
                  return next
                })
              }, 5000)
            }, 1000)
          }
        } catch (err) {
          console.error('Failed to parse progress:', err)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRefs.current.delete(jobId)
      }

      eventSourceRefs.current.set(jobId, eventSource)
    },
    [fetchJobs]
  )

  useEffect(() => {
    const init = async () => {
      const loadedJobs = await fetchJobs()
      loadedJobs.forEach((job: Job) => {
        if (job.status === 'running' && job.currentJobId) {
          if (!eventSourceRefs.current.has(job.currentJobId)) {
            connectToJobStream(job.name, job.currentJobId)
          }
        }
      })
    }
    init()

    const interval = setInterval(async () => {
      const loadedJobs = await fetchJobs()
      loadedJobs.forEach((job: Job) => {
        if (job.status === 'running' && job.currentJobId) {
          if (!eventSourceRefs.current.has(job.currentJobId)) {
            connectToJobStream(job.name, job.currentJobId)
          }
        }
      })
    }, 10000)

    const eventSources = eventSourceRefs.current
    return () => {
      clearInterval(interval)
      eventSources.forEach((es) => es.close())
    }
  }, [fetchJobs, connectToJobStream])

  const handleRunJob = async (jobName: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobName}/run`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        connectToJobStream(jobName, data.jobId)
        await fetchJobs()
      }
    } catch (err) {
      console.error('Failed to run job:', err)
    }
  }

  const handleCancelJob = async (jobName: string) => {
    setCancelDialogJob(null)
    setCancellingJobs((prev) => new Set(prev).add(jobName))

    try {
      const response = await fetch(`/api/jobs/${jobName}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        await fetchJobs()
      }
    } catch (err) {
      console.error('Failed to cancel job:', err)
    } finally {
      setCancellingJobs((prev) => {
        const next = new Set(prev)
        next.delete(jobName)
        return next
      })
    }
  }

  const toggleLogs = (jobName: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(jobName)) {
        next.delete(jobName)
      } else {
        next.add(jobName)
      }
      return next
    })
  }

  const runningCount = jobs.filter((j) => j.status === 'running').length

  return {
    jobs,
    loading,
    error,
    jobProgress,
    expandedLogs,
    cancelDialogJob,
    cancellingJobs,
    logsContainerRefs,
    runningCount,
    handleRunJob,
    handleCancelJob,
    toggleLogs,
    setCancelDialogJob,
  }
}

