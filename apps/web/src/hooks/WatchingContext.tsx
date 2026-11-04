import { useAuth } from './useAuth'
import { apiFetch, apiJson } from '../lib/api'
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

const CACHE_KEY = 'aperture_watching_v2:'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 1 day in milliseconds

interface CachedData {
  userId: string
  series: WatchingSeries[]
  timestamp: number
  version: number // For cache invalidation on schema changes
}

const CACHE_VERSION = 2

interface WatchingProviderProps {
  children: ReactNode
}

function getCache(userId: string): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY + userId)
    if (!cached) return null

    const data: CachedData = JSON.parse(cached)

    // Check version
    if (data.version !== CACHE_VERSION || data.userId !== userId) {
      localStorage.removeItem(CACHE_KEY + userId)
      return null
    }

    // Check TTL
    const age = Date.now() - data.timestamp
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY + userId)
      return null
    }

    return data
  } catch {
    return null
  }
}

function setCache(userId: string, series: WatchingSeries[]): void {
  try {
    const data: CachedData = {
      userId,
      series,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }
    localStorage.setItem(CACHE_KEY + userId, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to cache watching data:', err)
  }
}

function clearCache(userId: string): void {
  try {
    localStorage.removeItem(CACHE_KEY + userId)
  } catch {
    // Ignore errors
  }
}

export function WatchingProvider({ children }: WatchingProviderProps) {
  const { user } = useAuth()
  const userId = user?.id
  const activeUser = useRef(userId)
  activeUser.current = userId
  const [owner, setOwner] = useState<string | undefined>()
  const loadController = useRef<AbortController | null>(null)
  const [series, setSeries] = useState<WatchingSeries[]>([])
  const [watchingIds, setWatchingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWatchingData = useCallback(
    async (useCache = true) => {
      if (!userId) return
      loadController.current?.abort()
      const controller = new AbortController()
      loadController.current = controller
      const current = () => !controller.signal.aborted && activeUser.current === userId
      setLoading(true)
      try {
        const cached = useCache ? getCache(userId) : null
        let rows: WatchingSeries[] | undefined
        if (cached) {
          const membership = await apiJson<{ seriesIds: string[] }>(
            '/api/watching/ids',
            controller.signal
          )
          if (
            membership.seriesIds.length === cached.series.length &&
            membership.seriesIds.every((id) => cached.series.some((s) => s.seriesId === id))
          )
            rows = cached.series
        }
        if (!rows)
          rows = (await apiJson<{ series: WatchingSeries[] }>('/api/watching', controller.signal))
            .series
        if (!current()) return
        setOwner(userId)
        setSeries(rows)
        setWatchingIds(new Set(rows.map((s) => s.seriesId)))
        setError(null)
        if (!cached || rows !== cached.series) setCache(userId, rows)
      } catch (err) {
        if (current()) {
          clearCache(userId)
          setOwner(userId)
          setSeries([])
          setWatchingIds(new Set())
          setError(err instanceof Error ? err.message : 'Could not load watching list')
        }
      } finally {
        if (current()) setLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    // Legacy cache has no owner and must never seed a signed-in user's state.
    try {
      localStorage.removeItem('aperture_watching_cache')
    } catch {
      /* storage may be disabled */
    }
    setSeries([])
    setWatchingIds(new Set())
    setOwner(undefined)
    setError(null)
    setRefreshing(false)
    void fetchWatchingData(true)
    return () => loadController.current?.abort()
  }, [fetchWatchingData, userId])

  const isWatching = useCallback(
    (seriesId: string) => {
      return owner === userId && watchingIds.has(seriesId)
    },
    [watchingIds, owner, userId]
  )

  const addToWatching = useCallback(
    async (seriesId: string) => {
      if (!userId) return
      // Optimistic update for IDs
      setWatchingIds((prev) => new Set([...prev, seriesId]))

      try {
        const response = await apiFetch(`/api/watching/${seriesId}`, {
          method: 'POST',
          credentials: 'include',
        })

        if (activeUser.current !== userId) return
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
        clearCache(userId)
        await fetchWatchingData(false)
      } catch (err) {
        console.error('Failed to add to watching:', err)
        throw err
      }
    },
    [fetchWatchingData, userId]
  )

  const removeFromWatching = useCallback(
    async (seriesId: string) => {
      if (!userId) return
      // Optimistic update
      setWatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(seriesId)
        return next
      })
      setSeries((prev) => prev.filter((s) => s.seriesId !== seriesId))

      try {
        const response = await apiFetch(`/api/watching/${seriesId}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (activeUser.current !== userId) return
        if (!response.ok) {
          // Revert on failure
          setWatchingIds((prev) => new Set([...prev, seriesId]))
          await fetchWatchingData(false)
          throw new Error('Failed to remove from watching list')
        }

        // Update cache with new series list
        setSeries((current) => {
          setCache(userId, current)
          return current
        })
      } catch (err) {
        console.error('Failed to remove from watching:', err)
        throw err
      }
    },
    [fetchWatchingData, userId]
  )

  const toggleWatching = useCallback(
    async (seriesId: string) => {
      if (watchingIds.has(seriesId)) {
        await removeFromWatching(seriesId)
      } else {
        await addToWatching(seriesId)
      }
    },
    [watchingIds, addToWatching, removeFromWatching]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    if (userId) clearCache(userId)
    await fetchWatchingData(false)
  }, [fetchWatchingData, userId])

  const refreshLibrary = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await apiFetch(
        '/api/watching/refresh',
        {
          method: 'POST',
          credentials: 'include',
        },
        120_000
      )

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
    watchingIds: owner === userId ? watchingIds : new Set<string>(),
    series: owner === userId ? series : [],
    loading: Boolean(userId && (loading || owner !== userId)),
    error: owner === userId ? error : null,
    refreshing,
    isWatching,
    addToWatching,
    removeFromWatching,
    toggleWatching,
    refresh,
    refreshLibrary,
  }

  return <WatchingContext.Provider value={value}>{children}</WatchingContext.Provider>
}
