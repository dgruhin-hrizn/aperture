import { useEffect, useState } from 'react'
import type { Movie, SimilarMovie, RecommendationInsights, MediaServerInfo } from '../types'

export function useMovieDetail(id: string | undefined, userId: string | undefined) {
  const [movie, setMovie] = useState<Movie | null>(null)
  const [similar, setSimilar] = useState<SimilarMovie[]>([])
  const [insights, setInsights] = useState<RecommendationInsights | null>(null)
  const [mediaServer, setMediaServer] = useState<MediaServerInfo | null>(null)
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

          // Fetch recommendation insights if user is logged in
          if (userId) {
            const insightsResponse = await fetch(
              `/api/recommendations/${userId}/movie/${id}/insights`,
              { credentials: 'include' }
            )
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json()
              setInsights(insightsData)
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

  return {
    movie,
    similar,
    insights,
    mediaServer,
    loading,
    error,
  }
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

