import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProxiedImageUrl } from '@aperture/ui'

export type PersonPortraitPhase = 'media' | 'pending-tmdb' | 'tmdb' | 'none'

interface UsePersonPortraitOptions {
  personName: string
  mediaImageUrl: string | null | undefined
  tmdbImageUrl?: string | null
  fetchTmdbFallback?: boolean
}

export function usePersonPortrait({
  personName,
  mediaImageUrl,
  tmdbImageUrl,
  fetchTmdbFallback = false,
}: UsePersonPortraitOptions) {
  const [phase, setPhase] = useState<PersonPortraitPhase>('media')
  const [fetchedTmdbUrl, setFetchedTmdbUrl] = useState<string | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    setPhase('media')
    setFetchedTmdbUrl(null)
  }, [personName, mediaImageUrl, tmdbImageUrl])

  const resolvedTmdbUrl = tmdbImageUrl ?? fetchedTmdbUrl

  const displaySrc = useMemo(() => {
    if (phase === 'media' && mediaImageUrl) {
      return getProxiedImageUrl(mediaImageUrl, '')
    }
    if (phase === 'tmdb' && resolvedTmdbUrl) {
      return getProxiedImageUrl(resolvedTmdbUrl, '')
    }
    return undefined
  }, [mediaImageUrl, phase, resolvedTmdbUrl])

  const onImageError = useCallback(() => {
    if (phaseRef.current === 'media') {
      if (tmdbImageUrl) {
        setPhase('tmdb')
        return
      }

      if (fetchTmdbFallback) {
        setPhase('pending-tmdb')
        void fetch(
          `/api/discover/person-profile?name=${encodeURIComponent(personName)}`,
          { credentials: 'include' }
        )
          .then((r) => r.json())
          .then((data: { imageUrl?: string | null }) => {
            if (data?.imageUrl) {
              setFetchedTmdbUrl(data.imageUrl)
              setPhase('tmdb')
            } else {
              setPhase('none')
            }
          })
          .catch(() => {
            setPhase('none')
          })
        return
      }
    }

    setPhase('none')
  }, [fetchTmdbFallback, personName, tmdbImageUrl])

  return { displaySrc, phase, onImageError }
}
