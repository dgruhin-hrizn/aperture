/**
 * useWatchingData Hook
 *
 * Provides access to the user's watching series data from the central WatchingContext.
 * All data is cached for fast access across components.
 */

import { useEffect } from 'react'
import { useWatching } from '@/hooks/useWatching'

// Re-export types from context for convenience
export type { WatchingSeries, UpcomingEpisode } from '@/hooks/watching-context'

export function useWatchingData() {
  const {
    series,
    loading,
    error,
    refreshing,
    upcomingLoading,
    upcomingError,
    subscribeUpcoming,
    refreshUpcoming,
    removeFromWatching,
    refreshLibrary,
    refresh,
  } = useWatching()

  useEffect(() => subscribeUpcoming(), [subscribeUpcoming])

  return {
    series,
    loading,
    error,
    refreshing,
    upcomingLoading,
    upcomingError,
    refreshUpcoming,
    removeSeries: removeFromWatching,
    refreshLibrary,
    refetch: refresh,
  }
}
