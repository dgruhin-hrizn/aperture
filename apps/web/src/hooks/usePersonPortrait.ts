import { useCallback, useEffect, useState } from 'react'
import { cachedResource } from './cachedResource'
import { useAuth } from './useAuth'

export type PersonPortraitPhase = 'pending-tmdb' | 'tmdb' | 'none'
interface PortraitState {
  key: string
  src?: string
  phase: PersonPortraitPhase
}

/** Person artwork comes from TMDb; it never waits for the media server. */
export function usePersonPortrait({
  enabled = true,
  personName,
  tmdbImageUrl,
}: {
  enabled?: boolean
  personName: string
  tmdbImageUrl?: string | null
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const key = JSON.stringify([userId, personName, tmdbImageUrl])
  const [state, setState] = useState<PortraitState>({
    key,
    src: tmdbImageUrl ?? undefined,
    phase: tmdbImageUrl ? 'tmdb' : 'none',
  })
  useEffect(() => {
    const controller = new AbortController()
    if (!enabled || tmdbImageUrl) {
      setState({
        key,
        src: enabled ? (tmdbImageUrl ?? undefined) : undefined,
        phase: enabled && tmdbImageUrl ? 'tmdb' : 'none',
      })
    } else {
      setState({ key, phase: 'pending-tmdb' })
      void cachedResource<{ imageUrl?: string | null }>(
        userId,
        `/api/discover/person-profile?name=${encodeURIComponent(personName)}`,
        controller.signal,
        5 * 60_000
      )
        .then((data) => {
          if (!controller.signal.aborted)
            setState({
              key,
              src: data.imageUrl ?? undefined,
              phase: data.imageUrl ? 'tmdb' : 'none',
            })
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, phase: 'none' })
        })
    }
    return () => controller.abort()
  }, [key, enabled, personName, tmdbImageUrl, userId])

  const onImageError = useCallback(() => setState({ key, phase: 'none' }), [key])
  const current: PortraitState =
    state.key === key
      ? state
      : { key, src: tmdbImageUrl ?? undefined, phase: tmdbImageUrl ? 'tmdb' : 'pending-tmdb' }
  return {
    displaySrc: enabled ? current.src : undefined,
    phase: enabled ? current.phase : 'none',
    onImageError,
  }
}
