/**
 * useWatchingData Hook
 * 
 * Provides access to the user's watching series data from the central WatchingContext.
 * All data is cached for fast access across components.
 */

import { useWatching } from '@/hooks/useWatching'

// Re-export types from context for convenience
export type { WatchingSeries, UpcomingEpisode } from '@/hooks/WatchingContext'

export function useWatchingData() {
  const {
    series,
    loading,
    error,
    refreshing,
    removeFromWatching,
    refreshLibrary,
    refresh,
  } = useWatching()

  return {
    series,
    loading,
    error,
    refreshing,
    removeSeries: removeFromWatching,
    refreshLibrary,
    refetch: refresh,
  }
}
