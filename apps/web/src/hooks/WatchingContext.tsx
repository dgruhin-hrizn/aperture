import { useAuth } from './useAuth'
import { loadUpcomingBatches } from './watchingUpcoming'
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
  upcomingCheckedAt?: number
  version: number // For cache invalidation on schema changes
}

const CACHE_VERSION = 2
const UPCOMING_TTL_MS = 30 * 60_000

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

function setCache(
  userId: string,
  series: WatchingSeries[],
  timestamp = Date.now(),
  upcomingCheckedAt = 0
): void {
  try {
    const data: CachedData = {
      userId,
      series,
      timestamp,
      upcomingCheckedAt,
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
  const rowsRef = useRef<WatchingSeries[]>([])
  const cacheInfo = useRef({ timestamp: 0, upcomingCheckedAt: 0 })
  const updateRows = useCallback((next: WatchingSeries[]) => {
    rowsRef.current = next
    setSeries(next)
  }, [])
  const [upcomingConsumers, setUpcomingConsumers] = useState(0)
  const [metadataRevision, setMetadataRevision] = useState(0)
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [upcomingError, setUpcomingError] = useState(false)
  const subscribeUpcoming = useCallback(() => {
    setUpcomingConsumers((n) => n + 1)
    return () => setUpcomingConsumers((n) => Math.max(0, n - 1))
  }, [])
  const refreshUpcoming = useCallback(() => {
    cacheInfo.current.upcomingCheckedAt = 0
    setMetadataRevision((n) => n + 1)
  }, [])
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
          rows = (
            await apiJson<{ series: WatchingSeries[] }>(
              '/api/watching?includeUpcoming=false',
              controller.signal
            )
          ).series
        if (!current()) return
        const usingCache = rows === cached?.series
        cacheInfo.current = {
          timestamp: usingCache ? cached!.timestamp : Date.now(),
          upcomingCheckedAt: usingCache ? (cached!.upcomingCheckedAt ?? 0) : 0,
        }
        const today = new Date().toISOString().slice(0, 10)
        rows = rows.map((row) =>
          row.upcomingEpisode && row.upcomingEpisode.airDate.slice(0, 10) < today
            ? { ...row, upcomingEpisode: null }
            : row
        )
        setOwner(userId)
        updateRows(rows)
        setMetadataRevision((n) => n + 1)
        setWatchingIds(new Set(rows.map((s) => s.seriesId)))
        setError(null)
        setCache(userId, rows, cacheInfo.current.timestamp, cacheInfo.current.upcomingCheckedAt)
      } catch (err) {
        if (current()) {
          clearCache(userId)
          setOwner(userId)
          updateRows([])
          setWatchingIds(new Set())
          setError(err instanceof Error ? err.message : 'Could not load watching list')
        }
      } finally {
        if (current()) setLoading(false)
      }
    },
    [userId, updateRows]
  )

  useEffect(() => {
    // Legacy cache has no owner and must never seed a signed-in user's state.
    try {
      localStorage.removeItem('aperture_watching_cache')
    } catch {
      /* storage may be disabled */
    }
    updateRows([])
    setWatchingIds(new Set())
    setOwner(undefined)
    setError(null)
    setRefreshing(false)
    setUpcomingLoading(false)
    setUpcomingError(false)
    void fetchWatchingData(true)
    return () => loadController.current?.abort()
  }, [fetchWatchingData, userId, updateRows])

  const needsUpcoming = upcomingConsumers > 0
  useEffect(() => {
    if (!needsUpcoming || !userId || owner !== userId || loading) {
      setUpcomingLoading(false)
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const checked = cacheInfo.current.upcomingCheckedAt
    if (
      checked &&
      Date.now() - checked < UPCOMING_TTL_MS &&
      new Date(checked).toISOString().slice(0, 10) === today
    )
      return
    const ids = rowsRef.current.map((row) => row.seriesId)
    if (!ids.length) {
      setUpcomingLoading(false)
      return
    }
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && activeUser.current === userId
    setUpcomingLoading(true)
    setUpcomingError(false)
    void loadUpcomingBatches(ids, controller.signal, (batch) => {
      if (!current()) return
      const requested = new Set(batch.requestedSeriesIds),
        owned = new Set(batch.seriesIds),
        resolved = new Set(batch.resolvedSeriesIds)
      const rows = rowsRef.current
        .filter((row) => !requested.has(row.seriesId) || owned.has(row.seriesId))
        .map((row) =>
          resolved.has(row.seriesId)
            ? { ...row, upcomingEpisode: batch.episodes[row.seriesId] ?? null }
            : row
        )
      updateRows(rows)
      setWatchingIds(new Set(rows.map((row) => row.seriesId)))
      setCache(
        userId,
        rowsRef.current,
        cacheInfo.current.timestamp,
        cacheInfo.current.upcomingCheckedAt
      )
    })
      .then((complete) => {
        if (!current()) return
        if (complete) cacheInfo.current.upcomingCheckedAt = Date.now()
        setCache(
          userId,
          rowsRef.current,
          cacheInfo.current.timestamp,
          cacheInfo.current.upcomingCheckedAt
        )
        setUpcomingError(!complete)
      })
      .finally(() => {
        if (current()) setUpcomingLoading(false)
      })
    return () => controller.abort()
  }, [needsUpcoming, userId, owner, loading, metadataRevision, updateRows])

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
      updateRows(rowsRef.current.filter((s) => s.seriesId !== seriesId))

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
        setCache(
          userId,
          rowsRef.current,
          cacheInfo.current.timestamp,
          cacheInfo.current.upcomingCheckedAt
        )
      } catch (err) {
        console.error('Failed to remove from watching:', err)
        throw err
      }
    },
    [fetchWatchingData, userId, updateRows]
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
    upcomingLoading: owner === userId && upcomingLoading,
    upcomingError: owner === userId && upcomingError,
    subscribeUpcoming,
    refreshUpcoming,
    isWatching,
    addToWatching,
    removeFromWatching,
    toggleWatching,
    refresh,
    refreshLibrary,
  }

  return <WatchingContext.Provider value={value}>{children}</WatchingContext.Provider>
}
