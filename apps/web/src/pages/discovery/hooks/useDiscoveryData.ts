import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiscoveryCandidate, DiscoveryRun, DiscoveryStatus, MediaType, JellyseerrMediaStatus, DiscoveryFilterOptions } from '../types'

// Jellyseerr status for candidates (keyed by TMDb ID)
export type JellyseerrStatusMap = Record<number, JellyseerrMediaStatus>

// Build query string from filter options
function buildFilterQueryString(filters: DiscoveryFilterOptions): string {
  const params = new URLSearchParams()
  
  if (filters.languages && filters.languages.length > 0) {
    params.set('languages', filters.languages.join(','))
    // Include unknown language setting (only relevant when filtering by language)
    // Default is true, so only pass when explicitly set to false
    if (filters.includeUnknownLanguage === false) {
      params.set('includeUnknownLanguage', 'false')
    }
  }
  if (filters.genreIds && filters.genreIds.length > 0) {
    params.set('genres', filters.genreIds.join(','))
  }
  if (filters.yearStart !== undefined) {
    params.set('yearStart', filters.yearStart.toString())
  }
  if (filters.yearEnd !== undefined) {
    params.set('yearEnd', filters.yearEnd.toString())
  }
  if (filters.minSimilarity !== undefined && filters.minSimilarity > 0) {
    params.set('minSimilarity', filters.minSimilarity.toString())
  }
  
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

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

// Minimum target count before triggering expansion
const TARGET_DISPLAY_COUNT = 50
const EXPANSION_THRESHOLD = 20 // Trigger expansion when below this count

export function useDiscoveryData(filters: DiscoveryFilterOptions = {}) {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null)
  const [movieCandidates, setMovieCandidates] = useState<DiscoveryCandidate[]>([])
  const [seriesCandidates, setSeriesCandidates] = useState<DiscoveryCandidate[]>([])
  const [movieRun, setMovieRun] = useState<DiscoveryRun | null>(null)
  const [seriesRun, setSeriesRun] = useState<DiscoveryRun | null>(null)
  const [jellyseerrStatus, setJellyseerrStatus] = useState<JellyseerrStatusMap>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Track if this is the first load (for caching logic)
  const isFirstLoad = useRef(true)
  // Track current filters for comparison
  const filtersRef = useRef(filters)
  // Track if we've already tried to expand for current filters
  const expansionAttemptedRef = useRef<string>('')
  // Track expanding state via ref for use in callbacks (avoids stale closure)
  const expandingRef = useRef(false)

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

  const fetchCandidates = useCallback(async (mediaType: MediaType, filterOpts: DiscoveryFilterOptions = {}): Promise<{ candidates: DiscoveryCandidate[]; run: DiscoveryRun | null } | null> => {
    try {
      const queryString = buildFilterQueryString(filterOpts)
      const response = await fetch(`/api/discovery/${mediaType === 'movie' ? 'movies' : 'series'}${queryString}`, {
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

  /**
   * Expand discovery by dynamically fetching more candidates matching current filters
   * This is called automatically when the filtered count drops below threshold
   */
  const expandDiscovery = useCallback(async (mediaType: MediaType, currentCandidates: DiscoveryCandidate[]) => {
    // Create a key to track if we've already attempted expansion for these filters
    const expansionKey = `${mediaType}-${JSON.stringify(filters)}`
    
    // Don't expand if already expanding, already attempted, or have enough candidates
    if (expandingRef.current) {
      console.log('[Discovery] Already expanding, skipping')
      return null
    }
    if (currentCandidates.length >= EXPANSION_THRESHOLD) {
      return null
    }
    if (expansionAttemptedRef.current === expansionKey) {
      console.log('[Discovery] Already attempted for this filter combination, skipping')
      return null
    }

    // Mark as attempted BEFORE starting to prevent race conditions
    expansionAttemptedRef.current = expansionKey
    expandingRef.current = true
    setExpanding(true)

    try {
      // Get existing TMDb IDs to exclude from expansion
      const existingTmdbIds = currentCandidates.map(c => c.tmdbId)

      console.log('[Discovery] Expanding with filters:', { mediaType, filters, excludeCount: existingTmdbIds.length })

      const response = await fetch(`/api/discovery/${mediaType === 'movie' ? 'movies' : 'series'}/expand`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languages: filters.languages,
          genreIds: filters.genreIds,
          yearStart: filters.yearStart,
          yearEnd: filters.yearEnd,
          excludeTmdbIds: existingTmdbIds,
          targetCount: TARGET_DISPLAY_COUNT - currentCandidates.length,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Discovery] Expand failed:', response.status, errorText)
        return null
      }

      const data = await response.json()
      const newCandidates = data.candidates || []

      console.log('[Discovery] Expand returned', newCandidates.length, 'candidates')

      if (newCandidates.length === 0) {
        console.log('[Discovery] No new candidates found, expansion complete')
        return null
      }

      // Merge new candidates with existing ones
      const merged = [...currentCandidates, ...newCandidates]
      
      // Sort by finalScore descending
      merged.sort((a, b) => b.finalScore - a.finalScore)

      // Update state based on media type
      if (mediaType === 'movie') {
        setMovieCandidates(merged)
      } else {
        setSeriesCandidates(merged)
      }

      // Fetch Jellyseerr status for new candidates
      if (newCandidates.length > 0) {
        await fetchJellyseerrStatus(newCandidates)
      }

      return { candidates: merged, added: newCandidates.length }
    } catch (err) {
      console.error('Error expanding discovery:', err)
      // Reset attempted ref on error so user can retry
      expansionAttemptedRef.current = ''
      return null
    } finally {
      expandingRef.current = false
      setExpanding(false)
    }
    // Note: We intentionally don't include `expanding` in deps to prevent callback recreation
    // The `expanding` check uses a ref pattern internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, fetchJellyseerrStatus])

  // Check if filters have changed
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(filtersRef.current)
  if (filtersChanged) {
    filtersRef.current = filters
    // Reset expansion tracking when filters change
    expansionAttemptedRef.current = ''
  }

  useEffect(() => {
    const load = async () => {
      // Only use cache if no filters are applied and it's the first load
      const hasFilters = (filters.languages && filters.languages.length > 0) ||
                        (filters.genreIds && filters.genreIds.length > 0) ||
                        filters.yearStart !== undefined ||
                        filters.yearEnd !== undefined ||
                        (filters.minSimilarity !== undefined && filters.minSimilarity > 0)
      
      // Try to load from cache first (only if no filters and first load)
      if (isFirstLoad.current && !hasFilters) {
        const cached = loadCache()
        if (cached) {
          setMovieCandidates(cached.movieCandidates)
          setSeriesCandidates(cached.seriesCandidates)
          setMovieRun(cached.movieRun)
          setSeriesRun(cached.seriesRun)
          if (cached.status) setStatus(cached.status)
          setLoading(false)
          isFirstLoad.current = false
          
          // Fetch Jellyseerr status for cached candidates (always fresh)
          const allCandidates = [...cached.movieCandidates, ...cached.seriesCandidates]
          if (allCandidates.length > 0) {
            fetchJellyseerrStatus(allCandidates)
          }
          return
        }
      }
      
      setLoading(true)
      
      // Fetch from server with filters
      const [newStatus, movieResult, seriesResult] = await Promise.all([
        fetchStatus(),
        fetchCandidates('movie', filters),
        fetchCandidates('series', filters),
      ])
      
      // Only save to cache if no filters are applied
      if (!hasFilters) {
        saveCache({
          movieCandidates: movieResult?.candidates || [],
          seriesCandidates: seriesResult?.candidates || [],
          movieRun: movieResult?.run || null,
          seriesRun: seriesResult?.run || null,
          status: newStatus,
        })
      }
      
      isFirstLoad.current = false
      setLoading(false)
    }
    load()
  }, [fetchStatus, fetchCandidates, fetchJellyseerrStatus, filters])

  // Auto-expand when filters result in low candidate count
  useEffect(() => {
    const checkAndExpand = async () => {
      // Only expand if filters are active and count is low
      const hasFilters = (filters.languages && filters.languages.length > 0) ||
                        (filters.genreIds && filters.genreIds.length > 0) ||
                        filters.yearStart !== undefined ||
                        filters.yearEnd !== undefined

      if (!hasFilters || loading) {
        return
      }

      // Check movies
      if (movieCandidates.length > 0 && movieCandidates.length < EXPANSION_THRESHOLD) {
        console.log(`[Discovery] Movie count (${movieCandidates.length}) below threshold (${EXPANSION_THRESHOLD}), expanding...`)
        await expandDiscovery('movie', movieCandidates)
      }

      // Check series
      if (seriesCandidates.length > 0 && seriesCandidates.length < EXPANSION_THRESHOLD) {
        console.log(`[Discovery] Series count (${seriesCandidates.length}) below threshold (${EXPANSION_THRESHOLD}), expanding...`)
        await expandDiscovery('series', seriesCandidates)
      }
    }
    
    checkAndExpand()
  }, [filters, loading, movieCandidates.length, seriesCandidates.length, expandDiscovery])

  return {
    status,
    movieCandidates,
    seriesCandidates,
    movieRun,
    seriesRun,
    jellyseerrStatus,
    loading,
    refreshing,
    expanding,
    error,
    refresh,
    markAsRequested,
    expandDiscovery,
  }
}

