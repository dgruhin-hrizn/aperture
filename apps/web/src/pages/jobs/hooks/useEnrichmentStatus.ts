import { useEffect, useState, useCallback } from 'react'

export interface EnrichmentRun {
  id: string
  target_version: number
  expected_movies: number
  expected_series: number
  processed_movies: number
  processed_series: number
  enriched_movies: number
  enriched_series: number
  failed_movies: number
  failed_series: number
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
  job_id: string | null
  started_at: string
  completed_at: string | null
  last_updated_at: string
}

export interface EnrichmentStatus {
  hasIncompleteRun: boolean
  run: EnrichmentRun | null
  remainingMovies: number
  remainingSeries: number
}

export interface UseEnrichmentStatusReturn {
  status: EnrichmentStatus | null
  loading: boolean
  error: string | null
  clearInterruptedRun: () => Promise<boolean>
  refresh: () => Promise<void>
}

export function useEnrichmentStatus(): UseEnrichmentStatusReturn {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/enrichment/status', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        setError(null)
      } else {
        setError('Failed to load enrichment status')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const clearInterruptedRun = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/jobs/enrichment/clear-interrupted', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        await fetchStatus() // Refresh status after clearing
        return data.cleared
      }
      return false
    } catch {
      return false
    }
  }

  return {
    status,
    loading,
    error,
    clearInterruptedRun,
    refresh: fetchStatus,
  }
}

