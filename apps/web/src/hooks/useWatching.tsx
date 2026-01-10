/**
 * useWatching Hook
 * 
 * Manages the user's "Shows You Watch" list state.
 * Provides methods to add/remove series and check watching status.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

interface WatchingContextValue {
  /** Set of series IDs the user is watching */
  watchingIds: Set<string>
  /** Whether initial data is loading */
  loading: boolean
  /** Check if a series is in the watching list */
  isWatching: (seriesId: string) => boolean
  /** Add a series to the watching list */
  addToWatching: (seriesId: string) => Promise<void>
  /** Remove a series from the watching list */
  removeFromWatching: (seriesId: string) => Promise<void>
  /** Toggle watching status for a series */
  toggleWatching: (seriesId: string) => Promise<void>
  /** Refresh the watching list from server */
  refresh: () => Promise<void>
}

const WatchingContext = createContext<WatchingContextValue | null>(null)

interface WatchingProviderProps {
  children: ReactNode
}

export function WatchingProvider({ children }: WatchingProviderProps) {
  const [watchingIds, setWatchingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Fetch watching IDs on mount
  const fetchWatchingIds = useCallback(async () => {
    try {
      const response = await fetch('/api/watching/ids', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setWatchingIds(new Set(data.seriesIds))
      }
    } catch (err) {
      console.error('Failed to fetch watching IDs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWatchingIds()
  }, [fetchWatchingIds])

  const isWatching = useCallback((seriesId: string) => {
    return watchingIds.has(seriesId)
  }, [watchingIds])

  const addToWatching = useCallback(async (seriesId: string) => {
    // Optimistic update
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
    } catch (err) {
      console.error('Failed to add to watching:', err)
      throw err
    }
  }, [])

  const removeFromWatching = useCallback(async (seriesId: string) => {
    // Optimistic update
    setWatchingIds((prev) => {
      const next = new Set(prev)
      next.delete(seriesId)
      return next
    })

    try {
      const response = await fetch(`/api/watching/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        // Revert on failure
        setWatchingIds((prev) => new Set([...prev, seriesId]))
        throw new Error('Failed to remove from watching list')
      }
    } catch (err) {
      console.error('Failed to remove from watching:', err)
      throw err
    }
  }, [])

  const toggleWatching = useCallback(async (seriesId: string) => {
    if (watchingIds.has(seriesId)) {
      await removeFromWatching(seriesId)
    } else {
      await addToWatching(seriesId)
    }
  }, [watchingIds, addToWatching, removeFromWatching])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchWatchingIds()
  }, [fetchWatchingIds])

  const value: WatchingContextValue = {
    watchingIds,
    loading,
    isWatching,
    addToWatching,
    removeFromWatching,
    toggleWatching,
    refresh,
  }

  return (
    <WatchingContext.Provider value={value}>
      {children}
    </WatchingContext.Provider>
  )
}

export function useWatching() {
  const context = useContext(WatchingContext)
  if (!context) {
    throw new Error('useWatching must be used within a WatchingProvider')
  }
  return context
}
