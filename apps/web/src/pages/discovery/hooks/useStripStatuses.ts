import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import type { MediaType, SeerrMediaStatus } from '../types'
import { mediaKey, requestSignal } from './discoveryRequests'

/** Availability is optional enrichment: publish strips first and request each typed ID once per view. */
export function useStripStatuses(
  items: { tmdbId: number; mediaType: MediaType }[],
  enabled: boolean,
  view: string
) {
  const { user } = useAuth()
  const identity = JSON.stringify([user?.id, enabled, view])
  const session = useRef<{
    identity: string
    controller: AbortController
    requested: Set<string>
  }>()
  const [state, setState] = useState<{
    identity: string
    values: Record<string, SeerrMediaStatus>
  }>({ identity: '', values: {} })
  const key = JSON.stringify([
    ...new Map(
      items.filter((i) => i.tmdbId > 0).map((i) => [mediaKey(i.mediaType, i.tmdbId), i])
    ).values(),
  ])

  useEffect(() => {
    const current = { identity, controller: new AbortController(), requested: new Set<string>() }
    session.current = current
    return () => current.controller.abort()
  }, [identity])

  useEffect(() => {
    const current = session.current
    if (!user?.id || !enabled || !current || current.identity !== identity) return
    const pending = (JSON.parse(key) as typeof items).filter(
      (i) => !current.requested.has(mediaKey(i.mediaType, i.tmdbId))
    )
    for (const item of pending) current.requested.add(mediaKey(item.mediaType, item.tmdbId))
    void (async () => {
      for (let i = 0; i < pending.length && !current.controller.signal.aborted; i += 100) {
        const batch = pending.slice(i, i + 100)
        try {
          const response = await fetch('/api/seerr/status/batch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: requestSignal(current.controller.signal),
            body: JSON.stringify({ items: batch }),
          })
          if (!response.ok) continue
          const data = await response.json()
          if (current.controller.signal.aborted || session.current !== current) return
          const values =
            data.statusesByMedia ??
            Object.fromEntries(
              batch.flatMap((item) =>
                data.statuses?.[item.tmdbId]
                  ? [[mediaKey(item.mediaType, item.tmdbId), data.statuses[item.tmdbId]]]
                  : []
              )
            )
          setState((prev) => ({
            identity,
            values: { ...(prev.identity === identity ? prev.values : {}), ...values },
          }))
        } catch {
          // A status failure must not hide an otherwise usable strip.
        }
      }
    })()
  }, [key, identity, user?.id, enabled])

  return state.identity === identity ? state.values : {}
}
