import { useState, useEffect, useCallback } from 'react'
import type { DiscoveryCandidate, DiscoveryRun, DiscoveryStatus, MediaType, JellyseerrMediaStatus } from '../types'

// Jellyseerr status for candidates (keyed by TMDb ID)
export type JellyseerrStatusMap = Record<number, JellyseerrMediaStatus>

export function useDiscoveryData() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null)
  const [movieCandidates, setMovieCandidates] = useState<DiscoveryCandidate[]>([])
  const [seriesCandidates, setSeriesCandidates] = useState<DiscoveryCandidate[]>([])
  const [movieRun, setMovieRun] = useState<DiscoveryRun | null>(null)
  const [seriesRun, setSeriesRun] = useState<DiscoveryRun | null>(null)
  const [jellyseerrStatus, setJellyseerrStatus] = useState<JellyseerrStatusMap>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/discovery/status', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else if (response.status === 403) {
        setStatus({ enabled: false, requestEnabled: false, movieRun: null, seriesRun: null, movieCount: 0, seriesCount: 0 })
      } else {
        setError('Failed to load discovery status')
      }
    } catch {
      setError('Could not connect to server')
    }
  }, [])

  const fetchJellyseerrStatus = useCallback(async (candidates: DiscoveryCandidate[]) => {
    if (candidates.length === 0) return

    try {
      const items = candidates.map(c => ({
        tmdbId: c.tmdbId,
        mediaType: c.mediaType,
      }))

      const response = await fetch('/api/jellyseerr/status/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      })

      if (response.ok) {
        const data = await response.json()
        setJellyseerrStatus(prev => ({ ...prev, ...data.statuses }))
      }
    } catch {
      console.error('Could not fetch Jellyseerr status')
    }
  }, [])

  const fetchCandidates = useCallback(async (mediaType: MediaType) => {
    try {
      const response = await fetch(`/api/discovery/${mediaType === 'movie' ? 'movies' : 'series'}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const candidates = data.candidates || []
        
        if (mediaType === 'movie') {
          setMovieCandidates(candidates)
          setMovieRun(data.run)
        } else {
          setSeriesCandidates(candidates)
          setSeriesRun(data.run)
        }
        
        // Fetch Jellyseerr status for these candidates
        if (candidates.length > 0) {
          await fetchJellyseerrStatus(candidates)
        }
      } else if (response.status !== 403) {
        console.error('Failed to load candidates')
      }
    } catch {
      console.error('Could not fetch candidates')
    }
  }, [fetchJellyseerrStatus])

  const refresh = useCallback(async (mediaType: MediaType) => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/discovery/refresh/${mediaType === 'movie' ? 'movies' : 'series'}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        // Refresh the candidates
        await fetchCandidates(mediaType)
        await fetchStatus()
        return { success: true }
      } else {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to refresh' }
      }
    } catch {
      return { success: false, error: 'Could not connect to server' }
    } finally {
      setRefreshing(false)
    }
  }, [fetchCandidates, fetchStatus])

  // Mark an item as requested locally (after successful request)
  const markAsRequested = useCallback((tmdbId: number) => {
    setJellyseerrStatus(prev => ({
      ...prev,
      [tmdbId]: {
        ...prev[tmdbId],
        exists: false,
        status: 'pending',
        requested: true,
        requestStatus: 'pending',
      },
    }))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchStatus()
      await Promise.all([fetchCandidates('movie'), fetchCandidates('series')])
      setLoading(false)
    }
    load()
  }, [fetchStatus, fetchCandidates])

  return {
    status,
    movieCandidates,
    seriesCandidates,
    movieRun,
    seriesRun,
    jellyseerrStatus,
    loading,
    refreshing,
    error,
    refresh,
    markAsRequested,
  }
}

