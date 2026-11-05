import { useState, useEffect, useRef } from 'react'
import { cachedResource } from '../../../hooks/cachedResource'
import { requestSignal } from './discoveryRequests'

const DISCOVERY_JOB_NAME = 'generate-discovery-suggestions'
export const IDLE_POLL_MS = 60_000
export const RUNNING_POLL_MS = 5000

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
  error?: string
}

interface UseDiscoveryJobStatusOptions {
  onComplete?: () => void
  enabled?: boolean
  userId?: string
}

export function useDiscoveryJobStatus({
  onComplete,
  enabled = true,
  userId = 'session',
}: UseDiscoveryJobStatusOptions = {}) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    if (!enabled) {
      setIsRunning(false)
      setProgress(null)
      return
    }
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let stream: EventSource | undefined
    let jobId: string | undefined
    let running = false
    let requestVersion = 0
    const visible = () => document.visibilityState !== 'hidden'
    const completed = new Set<string>()
    const closeStream = () => {
      stream?.close()
      stream = undefined
    }
    const apply = (job: JobProgress) => {
      if (disposed || document.visibilityState === 'hidden') return
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        running = false
        setIsRunning(false)
        setProgress(null)
        closeStream()
        if (job.status === 'completed' && !completed.has(job.jobId)) {
          completed.add(job.jobId)
          completeRef.current?.()
        }
        jobId = undefined
      } else {
        running = true
        setIsRunning(true)
        setProgress(job)
      }
    }
    const subscribe = (id: string) => {
      closeStream()
      jobId = id
      const source = new EventSource(`/api/jobs/progress/stream/${id}`, { withCredentials: true })
      stream = source
      stream.onmessage = (event) => {
        if (stream !== source) return
        try {
          apply(JSON.parse(event.data) as JobProgress)
        } catch {
          /* Ignore malformed events. */
        }
      }
      stream.onerror = () => {
        if (stream === source) closeStream()
      } // The faster running-job poll reconnects a failed stream.
    }
    const check = async () => {
      if (disposed || document.visibilityState === 'hidden') return
      const version = ++requestVersion
      const current = new AbortController()
      controller = current
      try {
        const data = await cachedResource<{ jobs?: JobProgress[] }>(
          userId,
          '/api/jobs/active',
          current.signal,
          1000
        )
        if (current.signal.aborted || disposed || version !== requestVersion) return
        const job = data.jobs?.find(
          (j) => j.jobName === DISCOVERY_JOB_NAME && j.status === 'running'
        )
        if (job) {
          apply(job)
          if (!stream || jobId !== job.jobId) subscribe(job.jobId)
        } else if (jobId) {
          // A job may finish while the tab is hidden or SSE is disconnected.
          const finalResponse = await fetch(`/api/jobs/progress/${jobId}`, {
            credentials: 'include',
            signal: requestSignal(current.signal),
          })
          if (!current.signal.aborted && finalResponse.ok)
            apply((await finalResponse.json()) as JobProgress)
          else if (!current.signal.aborted) {
            running = false
            setIsRunning(false)
            setProgress(null)
            closeStream()
            jobId = undefined
          }
        }
      } catch {
        /* Retry later; a transient failure must not blank the page. */
      } finally {
        if (!disposed && visible() && version === requestVersion)
          timer = setTimeout(() => void check(), running ? RUNNING_POLL_MS : IDLE_POLL_MS)
      }
    }
    const visibility = () => {
      requestVersion++
      clearTimeout(timer)
      controller?.abort()
      if (document.visibilityState === 'hidden') closeStream()
      else void check()
    }
    void check()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('aperture:jobs-changed', visibility)
    return () => {
      disposed = true
      requestVersion++
      clearTimeout(timer)
      controller?.abort()
      closeStream()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('aperture:jobs-changed', visibility)
    }
  }, [enabled, userId])

  return { isRunning, progress }
}
