import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { cachedResource } from './cachedResource'

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

export function useActiveJobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobProgress[]>([])
  const userId = user?.id
  const isAdmin = user?.isAdmin
  useEffect(() => {
    if (!userId || !isAdmin) {
      setJobs([])
      return
    }
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let version = 0
    const poll = async () => {
      if (disposed || document.visibilityState === 'hidden') return
      const requestVersion = ++version
      const current = new AbortController()
      controller = current
      let running = false
      try {
        const data = await cachedResource<{ jobs?: JobProgress[] }>(
          userId,
          '/api/jobs/active',
          current.signal,
          1000
        )
        if (current.signal.aborted || disposed || requestVersion !== version) return
        setJobs(data.jobs || [])
        running = (data.jobs || []).some(
          (job) => job.status === 'running' || job.status === 'pending'
        )
      } catch {
        /* Keep the previous status on transient errors. */
      } finally {
        if (!disposed && !current.signal.aborted && requestVersion === version)
          timer = setTimeout(() => void poll(), running ? 2000 : 60_000)
      }
    }
    const visibility = () => {
      version++
      clearTimeout(timer)
      controller?.abort()
      if (document.visibilityState !== 'hidden') void poll()
    }
    void poll()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('aperture:jobs-changed', visibility)
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('aperture:jobs-changed', visibility)
    }
  }, [userId, isAdmin])

  return jobs
}
