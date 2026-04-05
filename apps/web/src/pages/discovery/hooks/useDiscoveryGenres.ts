import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaType } from '../types'

export type ResolveDiscoveryGenreName = (id: number, fallback?: string) => string

/**
 * Loads TMDb genre id → label map for the current UI language (via API, keyed by locale).
 */
export function useDiscoveryGenres(mediaType: MediaType) {
  const { i18n } = useTranslation()
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const locale = i18n.language

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      mediaType: mediaType === 'movie' ? 'movie' : 'series',
      locale,
    })

    fetch(`/api/discovery/genres?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || res.statusText)
        }
        return res.json() as Promise<{ genres: { id: number; name: string }[] }>
      })
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
    }
  }, [mediaType, locale])

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
