/**
 * WatchingProvider
 *
 * Provider for managing the user's "Shows You Watch" list state.
 * Includes caching with 1-day TTL to avoid slow re-fetches of enrichment data.
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import {
  WatchingContext,
  type WatchingRefreshResult,
  type WatchingSeries,
} from './watching-context'

const CACHE_KEY = 'aperture_watching_cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 1 day in milliseconds

interface CachedData {
  series: WatchingSeries[]
  timestamp: number
  version: number // For cache invalidation on schema changes
}

const CACHE_VERSION = 1

interface WatchingProviderProps {
  children: ReactNode
}

function getCache(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: CachedData = JSON.parse(cached)

    // Check version
    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    // Check TTL
    const age = Date.now() - data.timestamp
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    return data
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function setCache(series: WatchingSeries[]): void {
  try {
    const data: CachedData = {
      series,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to cache watching data:', err)
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore errors
  }
}

export function WatchingProvider({ children }: WatchingProviderProps) {
  const [series, setSeries] = useState<WatchingSeries[]>([])
  const [watchingIds, setWatchingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const fetchedRef = useRef(false)

  // Fetch full watching data
  const fetchWatchingData = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = getCache()
      if (cached) {
        setSeries(cached.series)
        setWatchingIds(new Set(cached.series.map(s => s.seriesId)))
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/watching', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to load watching list')
      }
      const data = await response.json()
      setSeries(data.series)
      setWatchingIds(new Set(data.series.map((s: WatchingSeries) => s.seriesId)))
      setError(null)

      // Cache the result
      setCache(data.series)
    } catch (err) {
      console.error('Failed to fetch watching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load watching list')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchWatchingData(true)
    }
  }, [fetchWatchingData])

  const isWatching = useCallback((seriesId: string) => {
    return watchingIds.has(seriesId)
  }, [watchingIds])

  const addToWatching = useCallback(async (seriesId: string) => {
    // Optimistic update for IDs
    setWatchingIds((prev) => new Set([...prev, seriesId]))

    try {
      const response = await fetch(`/api/watching/${seriesId}`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        // Revert on failure
        setWatchingIds((prev) => {
          const next = new Set(prev)
          next.delete(seriesId)
          return next
        })
        throw new Error('Failed to add to watching list')
      }

      // Clear cache and refetch to get enriched data for the new series
      clearCache()
      await fetchWatchingData(false)
    } catch (err) {
      console.error('Failed to add to watching:', err)
      throw err
    }
  }, [fetchWatchingData])

  const removeFromWatching = useCallback(async (seriesId: string) => {
    // Optimistic update
    setWatchingIds((prev) => {
      const next = new Set(prev)
      next.delete(seriesId)
      return next
    })
    setSeries((prev) => prev.filter((s) => s.seriesId !== seriesId))

    try {
      const response = await fetch(`/api/watching/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        // Revert on failure
        setWatchingIds((prev) => new Set([...prev, seriesId]))
        await fetchWatchingData(false)
        throw new Error('Failed to remove from watching list')
      }

      // Update cache with new series list
      setSeries((current) => {
        setCache(current)
        return current
      })
    } catch (err) {
      console.error('Failed to remove from watching:', err)
      throw err
    }
  }, [fetchWatchingData])

  const toggleWatching = useCallback(async (seriesId: string) => {
    if (watchingIds.has(seriesId)) {
      await removeFromWatching(seriesId)
    } else {
      await addToWatching(seriesId)
    }
  }, [watchingIds, addToWatching, removeFromWatching])

  const refresh = useCallback(async () => {
    setLoading(true)
    clearCache()
    await fetchWatchingData(false)
  }, [fetchWatchingData])

  const refreshLibrary = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/watching/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to refresh library')
      }

      const data = (await response.json()) as WatchingRefreshResult
      return data
    } catch (err) {
      console.error('Failed to refresh library:', err)
      throw err
    } finally {
      setRefreshing(false)
    }
  }, [])

  const value = {
    watchingIds,
    series,
    loading,
    error,
    refreshing,
    isWatching,
    addToWatching,
    removeFromWatching,
    toggleWatching,
    refresh,
    refreshLibrary,
  }

  return (
    <WatchingContext.Provider value={value}>
      {children}
    </WatchingContext.Provider>
  )
}
