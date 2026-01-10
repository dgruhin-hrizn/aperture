import { useEffect, useState, useCallback } from 'react'
import type { Series, Episode, SimilarSeries, MediaServerInfo } from '../types'

export function useSeriesDetail(id: string | undefined, userId: string | undefined) {
  const [series, setSeries] = useState<Series | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [seasons, setSeasons] = useState<Record<number, Episode[]>>({})
  const [similar, setSimilar] = useState<SimilarSeries[]>([])
  const [mediaServer, setMediaServer] = useState<MediaServerInfo | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSeries = async () => {
      if (!id) return
      
      setLoading(true)
      try {
        // Fetch series, episodes, and media server info in parallel
        const [seriesResponse, episodesResponse, mediaServerResponse] = await Promise.all([
          fetch(`/api/series/${id}`, { credentials: 'include' }),
          fetch(`/api/series/${id}/episodes`, { credentials: 'include' }),
          fetch('/api/settings/media-server', { credentials: 'include' }),
        ])

        // Process media server info
        if (mediaServerResponse.ok) {
          const mediaServerData = await mediaServerResponse.json()
          setMediaServer(mediaServerData)
        }

        if (seriesResponse.ok) {
          const data = await seriesResponse.json()
          setSeries(data)
          setError(null)

          // Process episodes
          if (episodesResponse.ok) {
            const episodesData = await episodesResponse.json()
            setEpisodes(episodesData.episodes || [])
            setSeasons(episodesData.seasons || {})
          }

          // Fetch similar series
          const similarResponse = await fetch(`/api/series/${id}/similar?limit=6`, {
            credentials: 'include',
          })
          if (similarResponse.ok) {
            const similarData = await similarResponse.json()
            setSimilar(similarData.similar || [])
          }

          // Fetch user rating if logged in
          if (userId) {
            const ratingsResponse = await fetch('/api/ratings', { credentials: 'include' })
            if (ratingsResponse.ok) {
              const ratingsData = await ratingsResponse.json()
              const seriesRating = ratingsData.ratings?.find(
                (r: { series_id: string }) => r.series_id === id
              )
              setUserRating(seriesRating?.rating || null)
            }
          }
        } else {
          setError('Series not found')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchSeries()
  }, [id, userId])

  const handleRate = useCallback(
    async (newRating: number) => {
      if (!userId || !id) return

      try {
        const method = newRating === 0 ? 'DELETE' : 'POST'
        const response = await fetch(`/api/ratings/series/${id}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: newRating !== 0 ? JSON.stringify({ rating: newRating }) : undefined,
        })

        if (response.ok) {
          setUserRating(newRating === 0 ? null : newRating)
        } else {
          console.error('Failed to save rating')
        }
      } catch (err) {
        console.error('Error saving rating', err)
      }
    },
    [id, userId]
  )

  return {
    series,
    episodes,
    seasons,
    similar,
    mediaServer,
    userRating,
    loading,
    error,
    handleRate,
  }
}


