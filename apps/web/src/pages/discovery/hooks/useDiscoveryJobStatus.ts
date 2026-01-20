import { useState, useEffect, useRef, useCallback } from 'react'

const DISCOVERY_JOB_NAME = 'generate-discovery-suggestions'
const POLL_INTERVAL_MS = 5000 // Check for running job every 5 seconds

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
}

export function useDiscoveryJobStatus(options: UseDiscoveryJobStatusOptions = {}) {
  const { onComplete } = options
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const onCompleteRef = useRef(onComplete)
  
  // Keep onComplete ref up to date
  onCompleteRef.current = onComplete

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const subscribeToJobProgress = useCallback((jobId: string) => {
    // Close existing connection if any
    closeEventSource()

    const eventSource = new EventSource(`/api/jobs/progress/stream/${jobId}`, {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as JobProgress
        setProgress(data)

        // Check if job finished
        if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'cancelled'
        ) {
          // Small delay before calling onComplete to let UI show final state
          setTimeout(() => {
            setIsRunning(false)
            setProgress(null)
            closeEventSource()
            
            // Only call onComplete for successful completion
            if (data.status === 'completed' && onCompleteRef.current) {
              onCompleteRef.current()
            }
          }, 1000)
        }
      } catch (err) {
        console.error('Failed to parse job progress:', err)
      }
    }

    eventSource.onerror = () => {
      // Connection error - close and let polling pick up again
      closeEventSource()
      setIsRunning(false)
      setProgress(null)
    }

    eventSourceRef.current = eventSource
  }, [closeEventSource])

  const checkForRunningJob = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/active', {
        credentials: 'include',
      })

      if (!response.ok) return

      const data = await response.json()
      const jobs = data.jobs || []
      
      // Find the discovery job if it's running
      const discoveryJob = jobs.find(
        (job: JobProgress) => job.jobName === DISCOVERY_JOB_NAME && job.status === 'running'
      )

      if (discoveryJob) {
        setIsRunning(true)
        setProgress(discoveryJob)
        
        // Subscribe to SSE for real-time updates if not already subscribed
        if (!eventSourceRef.current) {
          subscribeToJobProgress(discoveryJob.jobId)
        }
      } else {
        // Job not running
        if (isRunning) {
          // Was running, now stopped - this shouldn't normally happen
          // as SSE should catch completion, but handle it anyway
          setIsRunning(false)
          setProgress(null)
          closeEventSource()
        }
      }
    } catch (err) {
      console.error('Failed to check for running jobs:', err)
    }
  }, [isRunning, subscribeToJobProgress, closeEventSource])

  useEffect(() => {
    // Check immediately on mount
    checkForRunningJob()

    // Set up polling interval
    pollIntervalRef.current = setInterval(checkForRunningJob, POLL_INTERVAL_MS)

    return () => {
      // Cleanup
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      closeEventSource()
    }
  }, [checkForRunningJob, closeEventSource])

  return {
    isRunning,
    progress,
  }
}
