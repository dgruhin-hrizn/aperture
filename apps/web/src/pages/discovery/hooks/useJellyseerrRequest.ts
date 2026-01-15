import { useState, useCallback } from 'react'
import type { MediaType, JellyseerrMediaStatus } from '../types'

export function useJellyseerrRequest() {
  const [requesting, setRequesting] = useState<number | null>(null)
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

  const submitRequest = useCallback(async (
    tmdbId: number,
    mediaType: MediaType,
    title: string,
    discoveryCandidateId?: string
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

  const getCachedStatus = useCallback((tmdbId: number, mediaType: MediaType) => {
    return statusCache.get(`${mediaType}-${tmdbId}`)
  }, [statusCache])

  return {
    getMediaStatus,
    submitRequest,
    isRequesting,
    getCachedStatus,
    requesting,
  }
}

