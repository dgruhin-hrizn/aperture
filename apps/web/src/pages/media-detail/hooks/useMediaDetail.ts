import { apiFetch, apiJson } from '../../../lib/api'
import { cachedResource } from '../../../hooks/cachedResource'
import { useEffect, useState, useCallback, useRef } from 'react'
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
import { DEFAULT_SIMILAR_MEDIA_LIMIT } from '../constants'

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

  const identity = `${userId}:${mediaType}:${id}`
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const signal = controller.signal
    const scope = userId ?? 'anonymous'
    setRatingLoading(false)
    setLoading(true)
    setError(null)
    setSimilar([])
    setInsights(null)
    setWatchStats(null)
    setWatchStatus(null)
    setUserRating(null)
    setSeasons({})
    const base = `/api/${mediaType === 'movie' ? 'movies' : 'series'}/${id}`
    // Only the primary title controls the main skeleton. Optional sections settle independently.
    void apiJson<Media>(base, signal)
      .then((data) => {
        if (!signal.aborted) {
          setMedia({ ...data, type: mediaType } as Media)
          setLoadedIdentity(identity)
        }
      })
      .catch(() => {
        if (!signal.aborted) setError('Could not load title')
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })
    const optional = <T>(url: string, apply: (value: T) => void) => {
      void apiJson<T>(url, signal)
        .then((value) => {
          if (!signal.aborted) apply(value)
        })
        .catch(() => {})
    }
    void cachedResource<MediaServerInfo>(scope, '/api/settings/media-server', signal)
      .then((data) => {
        if (!signal.aborted) setMediaServer(data)
      })
      .catch(() => {})
    optional<{ similar: SimilarItem[] }>(
      `${base}/similar?limit=${DEFAULT_SIMILAR_MEDIA_LIMIT}`,
      (data) => setSimilar(data.similar || [])
    )
    optional<WatchStats>(`${base}/watch-stats`, setWatchStats)
    if (mediaType === 'series')
      optional<{ seasons: Record<number, Episode[]> }>(`${base}/episodes`, (data) =>
        setSeasons(data.seasons || {})
      )
    if (userId) {
      optional<RecommendationInsights>(
        `/api/recommendations/${userId}/${mediaType}/${id}/insights`,
        setInsights
      )
      optional<{ rating: number | null }>(`/api/ratings/${mediaType}/${id}`, (data) =>
        setUserRating(data.rating ?? null)
      )
      if (mediaType === 'movie')
        optional<WatchStatus>(`/api/users/${userId}/watch-history/movies/${id}`, setWatchStatus)
    }
    return () => controller.abort()
  }, [mediaType, id, userId, identity])

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
          const response = await apiFetch(endpoint, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (response.ok && currentIdentity.current === identity) {
            setUserRating(null)
          }
        } else {
          // Set rating
          const response = await apiFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ rating }),
          })
          if (response.ok && currentIdentity.current === identity) {
            setUserRating(rating)
          }
        }
      } catch (err) {
        console.error('Failed to update rating:', err)
      } finally {
        if (currentIdentity.current === identity) setRatingLoading(false)
      }
    },
    [mediaType, id, identity]
  )

  return {
    media: loadedIdentity === identity ? media : null,
    mediaType,
    similar,
    insights,
    mediaServer,
    watchStatus,
    watchStats,
    userRating,
    ratingLoading,
    loading: loading || (loadedIdentity !== identity && !error),
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
