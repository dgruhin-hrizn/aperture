import { useEffect, useState, useCallback } from 'react'
import type { Movie, SimilarMovie, RecommendationInsights, MediaServerInfo, WatchStatus } from '../types'

export function useMovieDetail(id: string | undefined, userId: string | undefined) {
  const [movie, setMovie] = useState<Movie | null>(null)
  const [similar, setSimilar] = useState<SimilarMovie[]>([])
  const [insights, setInsights] = useState<RecommendationInsights | null>(null)
  const [mediaServer, setMediaServer] = useState<MediaServerInfo | null>(null)
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true)
      try {
        // Fetch movie and media server info in parallel
        const [response, mediaServerResponse] = await Promise.all([
          fetch(`/api/movies/${id}`, { credentials: 'include' }),
          fetch('/api/settings/media-server', { credentials: 'include' }),
        ])

        // Process media server info
        if (mediaServerResponse.ok) {
          const mediaServerData = await mediaServerResponse.json()
          setMediaServer(mediaServerData)
        }

        if (response.ok) {
          const data = await response.json()
          setMovie(data)
          setError(null)

          // Fetch similar movies
          const similarResponse = await fetch(`/api/movies/${id}/similar?limit=6`, {
            credentials: 'include',
          })
          if (similarResponse.ok) {
            const similarData = await similarResponse.json()
            setSimilar(similarData.similar || [])
          }

          // Fetch recommendation insights and watch status if user is logged in
          if (userId) {
            const [insightsResponse, watchHistoryResponse] = await Promise.all([
              fetch(`/api/recommendations/${userId}/movie/${id}/insights`, { credentials: 'include' }),
              fetch(`/api/users/${userId}/watch-history?pageSize=1000&sortBy=title`, { credentials: 'include' }),
            ])

            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json()
              setInsights(insightsData)
            }

            if (watchHistoryResponse.ok) {
              const watchData = await watchHistoryResponse.json()
              const watchedMovie = watchData.history?.find((h: { movie_id: string }) => h.movie_id === id)
              if (watchedMovie) {
                setWatchStatus({
                  isWatched: true,
                  playCount: watchedMovie.play_count || 1,
                  lastWatched: watchedMovie.last_played_at,
                })
              } else {
                setWatchStatus({ isWatched: false, playCount: 0, lastWatched: null })
              }
            }
          }
        } else {
          setError('Movie not found')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchMovie()
    }
  }, [id, userId])

  const clearWatchStatus = useCallback(() => {
    setWatchStatus({ isWatched: false, playCount: 0, lastWatched: null })
  }, [])

  return {
    movie,
    similar,
    insights,
    mediaServer,
    watchStatus,
    loading,
    error,
    clearWatchStatus,
  }
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

