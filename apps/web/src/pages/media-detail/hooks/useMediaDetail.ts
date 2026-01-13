import { useEffect, useState, useCallback } from 'react'
import type {
  Media,
  MediaType,
  Episode,
  SimilarItem,
  RecommendationInsights,
  MediaServerInfo,
  WatchStatus,
  MovieWatchStats,
  SeriesWatchStats,
} from '../types'

export type WatchStats = MovieWatchStats | SeriesWatchStats

export interface UseMediaDetailReturn {
  media: Media | null
  mediaType: MediaType
  similar: SimilarItem[]
  insights: RecommendationInsights | null
  mediaServer: MediaServerInfo | null
  watchStatus: WatchStatus | null
  watchStats: WatchStats | null
  userRating: number | null
  ratingLoading: boolean
  loading: boolean
  error: string | null
  // Series-specific
  seasons: Record<number, Episode[]>
  // Movie-specific
  clearWatchStatus: () => void
  // Shared
  updateRating: (rating: number | null) => Promise<void>
}

export function useMediaDetail(
  mediaType: MediaType,
  id: string | undefined,
  userId: string | undefined
): UseMediaDetailReturn {
  const [media, setMedia] = useState<Media | null>(null)
  const [similar, setSimilar] = useState<SimilarItem[]>([])
  const [insights, setInsights] = useState<RecommendationInsights | null>(null)
  const [mediaServer, setMediaServer] = useState<MediaServerInfo | null>(null)
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [watchStats, setWatchStats] = useState<WatchStats | null>(null)
  // Series-specific
  const [seasons, setSeasons] = useState<Record<number, Episode[]>>({})

  useEffect(() => {
    const fetchMedia = async () => {
      if (!id) return

      setLoading(true)
      setError(null)

      try {
        const endpoint = mediaType === 'movie' ? `/api/movies/${id}` : `/api/series/${id}`

        // Fetch media and media server info in parallel
        const fetchPromises: Promise<Response>[] = [
          fetch(endpoint, { credentials: 'include' }),
          fetch('/api/settings/media-server', { credentials: 'include' }),
        ]

        // For series, also fetch episodes
        if (mediaType === 'series') {
          fetchPromises.push(fetch(`/api/series/${id}/episodes`, { credentials: 'include' }))
        }

        const responses = await Promise.all(fetchPromises)
        const [mediaResponse, mediaServerResponse, episodesResponse] = responses

        // Process media server info
        if (mediaServerResponse.ok) {
          const mediaServerData = await mediaServerResponse.json()
          setMediaServer(mediaServerData)
        }

        if (mediaResponse.ok) {
          const data = await mediaResponse.json()
          // Add type to the media object
          const mediaWithType = { ...data, type: mediaType } as Media
          setMedia(mediaWithType)

          // Process episodes for series
          if (mediaType === 'series' && episodesResponse?.ok) {
            const episodesData = await episodesResponse.json()
            setSeasons(episodesData.seasons || {})
          }

          // Fetch similar items
          const similarEndpoint =
            mediaType === 'movie'
              ? `/api/movies/${id}/similar?limit=6`
              : `/api/series/${id}/similar?limit=6`

          const similarResponse = await fetch(similarEndpoint, { credentials: 'include' })
          if (similarResponse.ok) {
            const similarData = await similarResponse.json()
            setSimilar(similarData.similar || [])
          }

          // Fetch watch stats (how many users watched)
          const watchStatsEndpoint =
            mediaType === 'movie'
              ? `/api/movies/${id}/watch-stats`
              : `/api/series/${id}/watch-stats`
          
          const watchStatsResponse = await fetch(watchStatsEndpoint, { credentials: 'include' })
          if (watchStatsResponse.ok) {
            const statsData = await watchStatsResponse.json()
            setWatchStats(statsData)
          }

          // Fetch user-specific data
          if (userId) {
            const userFetchPromises: Promise<Response>[] = []

            // Movie-specific: insights and watch history
            if (mediaType === 'movie') {
              userFetchPromises.push(
                fetch(`/api/recommendations/${userId}/movie/${id}/insights`, {
                  credentials: 'include',
                }),
                fetch(`/api/users/${userId}/watch-history?pageSize=1000&sortBy=title`, {
                  credentials: 'include',
                })
              )
            }

            // Rating endpoint (shared but different for movies/series)
            userFetchPromises.push(
              fetch(
                mediaType === 'movie' ? `/api/ratings/movie/${id}` : '/api/ratings',
                { credentials: 'include' }
              )
            )

            const userResponses = await Promise.all(userFetchPromises)

            if (mediaType === 'movie') {
              const [insightsResponse, watchHistoryResponse, ratingResponse] = userResponses

              if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json()
                setInsights(insightsData)
              }

              if (watchHistoryResponse.ok) {
                const watchData = await watchHistoryResponse.json()
                const watchedMovie = watchData.history?.find(
                  (h: { movie_id: string }) => h.movie_id === id
                )
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

              if (ratingResponse.ok) {
                const ratingData = await ratingResponse.json()
                setUserRating(ratingData.rating)
              }
            } else {
              // Series rating
              const [ratingResponse] = userResponses
              if (ratingResponse.ok) {
                const ratingsData = await ratingResponse.json()
                const seriesRating = ratingsData.ratings?.find(
                  (r: { series_id: string }) => r.series_id === id
                )
                setUserRating(seriesRating?.rating || null)
              }
            }
          }
        } else {
          setError(`${mediaType === 'movie' ? 'Movie' : 'Series'} not found`)
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [mediaType, id, userId])

  const clearWatchStatus = useCallback(() => {
    setWatchStatus({ isWatched: false, playCount: 0, lastWatched: null })
  }, [])

  const updateRating = useCallback(
    async (rating: number | null) => {
      if (!id) return

      setRatingLoading(true)
      try {
        const endpoint =
          mediaType === 'movie' ? `/api/ratings/movie/${id}` : `/api/ratings/series/${id}`

        if (rating === null || rating === 0) {
          // Delete rating
          const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (response.ok) {
            setUserRating(null)
          }
        } else {
          // Set rating
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ rating }),
          })
          if (response.ok) {
            setUserRating(rating)
          }
        }
      } catch (err) {
        console.error('Failed to update rating:', err)
      } finally {
        setRatingLoading(false)
      }
    },
    [mediaType, id]
  )

  return {
    media,
    mediaType,
    similar,
    insights,
    mediaServer,
    watchStatus,
    watchStats,
    userRating,
    ratingLoading,
    loading,
    error,
    seasons,
    clearWatchStatus,
    updateRating,
  }
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

