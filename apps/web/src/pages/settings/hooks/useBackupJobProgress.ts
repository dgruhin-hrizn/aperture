import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Owns polling for a backup or restore job's progress.
 *
 * The restore case drives the design. `pg_restore --clean` drops and recreates
 * every table, including `sessions`, so the admin who started the restore loses
 * their own session while it runs and every authenticated poll starts returning
 * 401. Treating that 401 as "the job finished" made a long restore look like it
 * completed in seconds while it was still running.
 *
 * The API therefore hands back a signed, job-scoped progress token when a restore
 * starts. Polling uses that token, which needs no database, so progress keeps
 * reporting across the window where the session no longer exists.
 */

/** Job progress as it arrives over the wire (dates are ISO strings, not Date). */
export interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: string
  currentStepIndex: number
  totalSteps: number
  overallProgress: number
  itemsProcessed: number
  itemsTotal: number
  logs: Array<{ timestamp: string; level: string; message: string }>
  error?: string
  result?: Record<string, unknown>
}

export type JobFinishedReason = 'completed' | 'failed' | 'cancelled'

interface UseBackupJobProgressOptions {
  /** Called once when the job reaches a terminal state. */
  onFinished: (reason: JobFinishedReason, progress: JobProgress) => void
  /** Called when tracking is abandoned because auth failed and no token is available. */
  onAuthLost: () => void
}

interface UseBackupJobProgressResult {
  activeJobId: string | null
  jobProgress: JobProgress | null
  /** Milliseconds since the job started, or 0 when nothing is tracked. */
  elapsedMs: number
  trackJob: (jobId: string, progressToken?: string) => void
  stopTracking: () => void
}

const POLL_INTERVAL_MS = 1000

export function useBackupJobProgress({
  onFinished,
  onAuthLost,
}: UseBackupJobProgressOptions): UseBackupJobProgressResult {
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const tokenRef = useRef<string | undefined>(undefined)
  const pollRef = useRef<number | null>(null)

  // Keep callbacks in refs so changing identities do not restart polling.
  const onFinishedRef = useRef(onFinished)
  const onAuthLostRef = useRef(onAuthLost)
  useEffect(() => {
    onFinishedRef.current = onFinished
    onAuthLostRef.current = onAuthLost
  }, [onFinished, onAuthLost])

  const stopTracking = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    tokenRef.current = undefined
    setActiveJobId(null)
    setJobProgress(null)
    setElapsedMs(0)
  }, [])

  const trackJob = useCallback((jobId: string, progressToken?: string) => {
    tokenRef.current = progressToken
    setJobProgress(null)
    setElapsedMs(0)
    setActiveJobId(jobId)
  }, [])

  const poll = useCallback(async (jobId: string) => {
    const token = tokenRef.current
    const url = token
      ? `/api/jobs/progress/${jobId}?token=${encodeURIComponent(token)}`
      : `/api/jobs/progress/${jobId}`

    let res: Response
    try {
      res = await fetch(url, { credentials: 'include' })
    } catch {
      // Network blip, or the API restarting mid-restore. Keep polling.
      return
    }

    if (res.status === 401 || res.status === 403) {
      if (token) {
        // Expected while a restore replaces the sessions table. The token should
        // still work; keep polling rather than declaring the job over.
        return
      }
      stopTracking()
      onAuthLostRef.current()
      return
    }

    if (res.status === 404) {
      // Progress expired from the in-memory store; nothing more to report.
      stopTracking()
      return
    }

    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      // Transient proxy/HTML response. Keep polling instead of guessing.
      return
    }

    let data: JobProgress
    try {
      data = (await res.json()) as JobProgress
    } catch {
      return
    }

    setJobProgress(data)
    if (data.startedAt) {
      const started = new Date(data.startedAt).getTime()
      if (Number.isFinite(started)) {
        setElapsedMs(Math.max(0, Date.now() - started))
      }
    }

    if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      tokenRef.current = undefined
      setActiveJobId(null)
      onFinishedRef.current(data.status, data)
    }
  }, [stopTracking])

  useEffect(() => {
    if (!activeJobId) return

    void poll(activeJobId)
    pollRef.current = window.setInterval(() => {
      void poll(activeJobId)
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [activeJobId, poll])

  return { activeJobId, jobProgress, elapsedMs, trackJob, stopTracking }
}
