import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../hooks/useAuth'
import { discoveryResource } from './discoveryRequests'
import type { MediaType } from '../types'

export type ResolveDiscoveryGenreName = (id: number, fallback?: string) => string

/**
 * Loads TMDb genre id → label map for the current UI language (via API, keyed by locale).
 */
export function useDiscoveryGenres(mediaType: MediaType | null) {
  const { user } = useAuth()
  const userId = user?.id
  const { i18n } = useTranslation()
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const locale = i18n.language

  useEffect(() => {
    if (!mediaType || !userId) { setGenres([]); setLoading(false); return }
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      mediaType: mediaType === 'movie' ? 'movie' : 'series',
      locale,
    })

    discoveryResource<{ genres: { id: number; name: string }[] }>(userId, `/api/discovery/genres?${params.toString()}`, controller.signal)
      .then((data) => {
        if (!cancelled) setGenres(data.genres ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGenres([])
          setError(err instanceof Error ? err.message : 'Failed to load genres')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [mediaType, locale, userId])

  const genreNameById = useMemo(
    () => new Map(genres.map((g) => [g.id, g.name] as const)),
    [genres]
  )

  const resolveGenreName = useCallback<ResolveDiscoveryGenreName>(
    (id, fallback) => genreNameById.get(id) ?? fallback ?? '',
    [genreNameById]
  )

  return { genres, loading, error, genreNameById, resolveGenreName }
}
