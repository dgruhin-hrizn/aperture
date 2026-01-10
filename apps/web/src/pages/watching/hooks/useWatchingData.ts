/**
 * useWatchingData Hook
 * 
 * Fetches and manages the user's watching series data for the watching page.
 */

import { useState, useEffect, useCallback } from 'react'

export interface UpcomingEpisode {
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate: string
  source: 'emby' | 'tmdb'
}

export interface WatchingSeries {
  id: string
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  overview: string | null
  communityRating: number | null
  network: string | null
  status: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  addedAt: string
  upcomingEpisode: UpcomingEpisode | null
}

export function useWatchingData() {
  const [series, setSeries] = useState<WatchingSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWatching = useCallback(async () => {
    try {
      const response = await fetch('/api/watching', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to load watching list')
      }
      const data = await response.json()
      setSeries(data.series)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch watching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load watching list')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWatching()
  }, [fetchWatching])

  const removeSeries = useCallback(async (seriesId: string) => {
    // Optimistic update
    setSeries((prev) => prev.filter((s) => s.seriesId !== seriesId))

    try {
      const response = await fetch(`/api/watching/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        // Revert and refetch on failure
        await fetchWatching()
        throw new Error('Failed to remove series')
      }
    } catch (err) {
      console.error('Failed to remove series:', err)
      throw err
    }
  }, [fetchWatching])

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

      const data = await response.json()
      return data
    } catch (err) {
      console.error('Failed to refresh library:', err)
      throw err
    } finally {
      setRefreshing(false)
    }
  }, [])

  return {
    series,
    loading,
    error,
    refreshing,
    removeSeries,
    refreshLibrary,
    refetch: fetchWatching,
  }
}

