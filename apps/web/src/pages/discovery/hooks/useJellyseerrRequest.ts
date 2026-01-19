import { useState, useCallback } from 'react'
import type { MediaType, JellyseerrMediaStatus } from '../types'
import type { SeasonInfo } from '../components/SeasonSelectModal'

// TV details response from Jellyseerr API
export interface TVDetailsResponse {
  id: number
  name: string
  originalName: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  firstAirDate?: string
  lastAirDate?: string
  numberOfSeasons?: number
  numberOfEpisodes?: number
  voteAverage?: number
  voteCount?: number
  genres: { id: number; name: string }[]
  networks: { id: number; name: string; logoPath?: string }[]
  mediaInfo?: {
    id: number
    status: number
    requests?: Array<{
      id: number
      status: number
    }>
  }
  seasons?: Array<{
    id: number
    seasonNumber: number
    episodeCount: number
    airDate?: string
    name: string
    overview?: string
    posterPath?: string
    status?: number
  }>
}

export function useJellyseerrRequest() {
  const [requesting, setRequesting] = useState<number | null>(null)
  const [fetchingDetails, setFetchingDetails] = useState<number | null>(null)
  const [statusCache, setStatusCache] = useState<Map<string, JellyseerrMediaStatus>>(new Map())

  const getMediaStatus = useCallback(async (tmdbId: number, mediaType: MediaType): Promise<JellyseerrMediaStatus | null> => {
    const cacheKey = `${mediaType}-${tmdbId}`
    const cached = statusCache.get(cacheKey)
    if (cached) return cached

    try {
      const jellyseerrType = mediaType === 'movie' ? 'movie' : 'tv'
      const response = await fetch(`/api/jellyseerr/status/${jellyseerrType}/${tmdbId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.jellyseerrStatus) {
          setStatusCache(prev => new Map(prev).set(cacheKey, data.jellyseerrStatus))
          return data.jellyseerrStatus
        }
      }
      return null
    } catch {
      return null
    }
  }, [statusCache])

  /**
   * Fetch TV details including season information for the season selection modal
   */
  const fetchTVDetails = useCallback(async (tmdbId: number): Promise<{ 
    seasons: SeasonInfo[]
    title: string
    posterPath?: string
  } | null> => {
    setFetchingDetails(tmdbId)
    try {
      const response = await fetch(`/api/jellyseerr/tv/${tmdbId}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        console.error('Failed to fetch TV details')
        return null
      }

      const data: TVDetailsResponse = await response.json()
      
      // Transform seasons to SeasonInfo format
      const seasons: SeasonInfo[] = (data.seasons || []).map(s => ({
        id: s.id,
        seasonNumber: s.seasonNumber,
        episodeCount: s.episodeCount,
        airDate: s.airDate,
        name: s.name || (s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}`),
        overview: s.overview,
        posterPath: s.posterPath,
        status: s.status ?? 1, // Default to 'unknown' if not set
      }))

      // Sort seasons by number (specials first, then 1, 2, 3...)
      seasons.sort((a, b) => a.seasonNumber - b.seasonNumber)

      return {
        seasons,
        title: data.name,
        posterPath: data.posterPath,
      }
    } catch (err) {
      console.error('Error fetching TV details:', err)
      return null
    } finally {
      setFetchingDetails(null)
    }
  }, [])

  const submitRequest = useCallback(async (
    tmdbId: number,
    mediaType: MediaType,
    title: string,
    discoveryCandidateId?: string,
    seasons?: number[] // Optional seasons array for TV requests
  ): Promise<{ success: boolean; error?: string }> => {
    setRequesting(tmdbId)
    try {
      const response = await fetch('/api/jellyseerr/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          title,
          discoveryCandidateId,
          seasons, // Pass seasons to the API
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        // Update cache to show as requested
        const cacheKey = `${mediaType}-${tmdbId}`
        setStatusCache(prev => {
          const newCache = new Map(prev)
          const existing = newCache.get(cacheKey) || { exists: false, status: 'unknown' as const }
          newCache.set(cacheKey, {
            ...existing,
            requested: true,
            requestStatus: 'pending',
          })
          return newCache
        })
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Failed to submit request' }
      }
    } catch {
      return { success: false, error: 'Could not connect to server' }
    } finally {
      setRequesting(null)
    }
  }, [])

  const isRequesting = useCallback((tmdbId: number) => requesting === tmdbId, [requesting])
  const isFetchingDetails = useCallback((tmdbId: number) => fetchingDetails === tmdbId, [fetchingDetails])

  const getCachedStatus = useCallback((tmdbId: number, mediaType: MediaType) => {
    return statusCache.get(`${mediaType}-${tmdbId}`)
  }, [statusCache])

  return {
    getMediaStatus,
    fetchTVDetails,
    submitRequest,
    isRequesting,
    isFetchingDetails,
    getCachedStatus,
    requesting,
  }
}

