import { useState, useEffect, useCallback } from 'react'
import type { DiscoveryCandidate, DiscoveryRun, DiscoveryStatus, MediaType, JellyseerrMediaStatus } from '../types'

// Jellyseerr status for candidates (keyed by TMDb ID)
export type JellyseerrStatusMap = Record<number, JellyseerrMediaStatus>

// Cache configuration
const CACHE_KEY = 'aperture_discovery_cache'
const CACHE_VERSION = 2 // Bumped to clear stale genre data
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour (discovery data changes less frequently)

interface DiscoveryCache {
  version: number
  timestamp: number
  movieCandidates: DiscoveryCandidate[]
  seriesCandidates: DiscoveryCandidate[]
  movieRun: DiscoveryRun | null
  seriesRun: DiscoveryRun | null
  status: DiscoveryStatus | null
}

function loadCache(): DiscoveryCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    
    const data = JSON.parse(cached) as DiscoveryCache
    if (data.version !== CACHE_VERSION) return null
    if (Date.now() - data.timestamp > CACHE_TTL_MS) return null
    
    return data
  } catch {
    return null
  }
}

function saveCache(cache: Omit<DiscoveryCache, 'version' | 'timestamp'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...cache,
      version: CACHE_VERSION,
      timestamp: Date.now(),
    }))
  } catch {
    // Storage full or unavailable
  }
}

function invalidateCache() {
  localStorage.removeItem(CACHE_KEY)
}

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
        return data as DiscoveryStatus
      } else if (response.status === 403) {
        const fallbackStatus = { enabled: false, requestEnabled: false, movieRun: null, seriesRun: null, movieCount: 0, seriesCount: 0 }
        setStatus(fallbackStatus)
        return fallbackStatus
      } else {
        setError('Failed to load discovery status')
        return null
      }
    } catch {
      setError('Could not connect to server')
      return null
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

  const fetchCandidates = useCallback(async (mediaType: MediaType): Promise<{ candidates: DiscoveryCandidate[]; run: DiscoveryRun | null } | null> => {
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
        
        return { candidates, run: data.run }
      } else if (response.status !== 403) {
        console.error('Failed to load candidates')
      }
      return null
    } catch {
      console.error('Could not fetch candidates')
      return null
    }
  }, [fetchJellyseerrStatus])

  const refresh = useCallback(async (mediaType: MediaType) => {
    setRefreshing(true)
    invalidateCache() // Clear cache when manually refreshing
    try {
      const response = await fetch(`/api/discovery/refresh/${mediaType === 'movie' ? 'movies' : 'series'}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        // Refresh the candidates
        const movieResult = await fetchCandidates('movie')
        const seriesResult = await fetchCandidates('series')
        const newStatus = await fetchStatus()
        
        // Save to cache
        saveCache({
          movieCandidates: movieResult?.candidates || movieCandidates,
          seriesCandidates: seriesResult?.candidates || seriesCandidates,
          movieRun: movieResult?.run || movieRun,
          seriesRun: seriesResult?.run || seriesRun,
          status: newStatus,
        })
        
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
  }, [fetchCandidates, fetchStatus, movieCandidates, seriesCandidates, movieRun, seriesRun])

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
      
      // Try to load from cache first
      const cached = loadCache()
      if (cached) {
        setMovieCandidates(cached.movieCandidates)
        setSeriesCandidates(cached.seriesCandidates)
        setMovieRun(cached.movieRun)
        setSeriesRun(cached.seriesRun)
        if (cached.status) setStatus(cached.status)
        setLoading(false)
        
        // Fetch Jellyseerr status for cached candidates (always fresh)
        const allCandidates = [...cached.movieCandidates, ...cached.seriesCandidates]
        if (allCandidates.length > 0) {
          fetchJellyseerrStatus(allCandidates)
        }
        return
      }
      
      // No valid cache, fetch from server
      const [newStatus, movieResult, seriesResult] = await Promise.all([
        fetchStatus(),
        fetchCandidates('movie'),
        fetchCandidates('series'),
      ])
      
      // Save to cache
      saveCache({
        movieCandidates: movieResult?.candidates || [],
        seriesCandidates: seriesResult?.candidates || [],
        movieRun: movieResult?.run || null,
        seriesRun: seriesResult?.run || null,
        status: newStatus,
      })
      
      setLoading(false)
    }
    load()
  }, [fetchStatus, fetchCandidates, fetchJellyseerrStatus])

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

