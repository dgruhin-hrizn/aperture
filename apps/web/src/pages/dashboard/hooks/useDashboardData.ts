import { apiFetch } from '../../../lib/api'
import { useState, useEffect, useCallback } from 'react'

interface DashboardStats {
  moviesWatched: number
  seriesWatched: number
  ratingsCount: number
  watchTimeMinutes: number
}

interface DashboardRecommendation {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  matchScore: number | null
}

interface DashboardTopPick {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  rank: number
  popularityScore: number
}

interface DashboardRecentWatch {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  lastWatched: Date
  playCount: number
  lastEpisode?: {
    seasonNumber: number
    episodeNumber: number
  }
}

interface DashboardRecentRating {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  rating: number
  ratedAt: Date
}

interface DashboardData {
  stats: DashboardStats
  recommendations: DashboardRecommendation[]
  topPicks: DashboardTopPick[]
  recentWatches: DashboardRecentWatch[]
  recentRatings: DashboardRecentRating[]
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/dashboard', {
        credentials: 'include',
        signal,
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const dashboardData = await response.json()
      if (!signal?.aborted) setData(dashboardData)
    } catch (err) {
      if (signal?.aborted) return
      console.error('Dashboard fetch error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchDashboard(controller.signal)
    return () => controller.abort()
  }, [fetchDashboard])

  return {
    data,
    loading,
    error,
    refetch: () => fetchDashboard(),
  }
}
