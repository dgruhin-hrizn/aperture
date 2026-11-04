import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import type {
  DiscoveryCandidate,
  DiscoveryStatus,
  MediaType,
  SeerrMediaStatus,
  DiscoveryFilterOptions,
} from '../types'
import {
  filterQuery,
  invalidateDiscoveryCache,
  retireLegacyCache,
  loadCandidates,
  mediaKey,
  requestSignal,
  type CandidateResponse,
} from './discoveryRequests'

export { invalidateDiscoveryCache } from './discoveryRequests'
export type SeerrStatusMap = Record<string, SeerrMediaStatus>
const EMPTY_FILTERS: DiscoveryFilterOptions = {}
const EMPTY_CANDIDATES: DiscoveryCandidate[] = []

export function useDiscoveryData(
  filters: DiscoveryFilterOptions = EMPTY_FILTERS,
  activeType: MediaType | null = 'movie'
) {
  const { user } = useAuth()
  const userId = user?.id
  const query = filterQuery(filters)
  const identity = `${userId}:${activeType}:${query}`
  const [statusState, setStatusState] = useState<{ userId: string; value: DiscoveryStatus } | null>(
    null
  )
  const status = statusState?.userId === userId ? (statusState?.value ?? null) : null
  const [lists, setLists] = useState<Record<string, CandidateResponse>>({})
  const [statuses, setStatuses] = useState<{ userId?: string; values: SeerrStatusMap }>({
    values: {},
  })
  const [validatedKey, setValidatedKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expandingKey, setExpandingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const expansionAttempts = useRef(new Set<string>())
  const requestRevision = useRef(0)
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const validated = validatedKey === `${identity}:${revision}`
  const candidates = validated
    ? (lists[identity]?.candidates ?? EMPTY_CANDIDATES)
    : EMPTY_CANDIDATES

  useEffect(() => {
    setLists({})
    setStatuses({ userId, values: {} })
    setError(null)
    expansionAttempts.current.clear()
    retireLegacyCache()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/discovery/status', {
          credentials: 'include',
          signal: requestSignal(controller.signal),
        })
        if (!response.ok) throw new Error('Failed to load discovery status')
        const value = (await response.json()) as DiscoveryStatus
        if (!controller.signal.aborted) {
          setStatusState({ userId, value })
          if (!value.enabled) {
            setLists({})
            invalidateDiscoveryCache(userId)
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatusState(null)
          setError('Could not load discovery status')
          setValidatedKey(null)
        }
      }
    }
    void loadStatus()
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRevision((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, revision])

  useEffect(() => {
    if (!userId || !activeType || !status?.enabled) return
    const controller = new AbortController()
    setValidatedKey(null)
    setError(null)
    void loadCandidates(userId, activeType, query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setLists((prev) =>
            Object.fromEntries(
              [...Object.entries(prev).filter(([key]) => key !== identity), [identity, data]].slice(
                -8
              )
            )
          )
          setValidatedKey(`${identity}:${revision}`)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load discovery suggestions')
      })
    return () => controller.abort()
  }, [userId, activeType, query, identity, status?.enabled, revision])

  // Candidate loading finishes before optional availability checks. Obsolete responses never update another list.
  useEffect(() => {
    if (!userId || !status?.enabled || !candidates.length) return
    const controller = new AbortController()
    const version = requestRevision.current
    void (async () => {
      for (let i = 0; i < candidates.length; i += 100) {
        const batch = candidates.slice(i, i + 100)
        const response = await fetch('/api/seerr/status/batch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: requestSignal(controller.signal),
          body: JSON.stringify({
            items: batch.map((c) => ({ tmdbId: c.tmdbId, mediaType: c.mediaType })),
          }),
        })
        if (!response.ok) continue
        const data = await response.json()
        if (controller.signal.aborted || requestRevision.current !== version) return
        const values: SeerrStatusMap =
          data.statusesByMedia ??
          Object.fromEntries(
            batch.flatMap((c) =>
              data.statuses?.[c.tmdbId]
                ? [[mediaKey(c.mediaType, c.tmdbId), data.statuses[c.tmdbId]]]
                : []
            )
          )
        setStatuses((prev) => ({
          userId,
          values: { ...(prev.userId === userId ? prev.values : {}), ...values },
        }))
      }
    })().catch(() => {
      /* Availability is optional; suggestions remain usable. */
    })
    return () => controller.abort()
  }, [userId, candidates, status?.enabled])

  // Expand only the visible filtered list. Abort when filters, tabs or users change.
  useEffect(() => {
    const hasFilters =
      filters.languages?.length ||
      filters.genreIds?.length ||
      filters.yearStart !== undefined ||
      filters.yearEnd !== undefined
    if (
      !userId ||
      !activeType ||
      !status?.enabled ||
      !hasFilters ||
      !validated ||
      !candidates.length ||
      candidates.length >= 20 ||
      expansionAttempts.current.has(identity)
    )
      return
    expansionAttempts.current.add(identity)
    const controller = new AbortController()
    setExpandingKey(identity)
    void fetch(`/api/discovery/${activeType === 'movie' ? 'movies' : 'series'}/expand`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: requestSignal(controller.signal, 60_000),
      body: JSON.stringify({
        ...filters,
        excludeTmdbIds: candidates.map((c) => c.tmdbId),
        targetCount: 50 - candidates.length,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Expansion failed')
        const data = (await response.json()) as CandidateResponse
        if (controller.signal.aborted) return
        setLists((prev) => {
          const existing = prev[identity]
          if (!existing) return prev
          const unique = new Map(
            [...existing.candidates, ...data.candidates].map((c) => [c.tmdbId, c])
          )
          return {
            ...prev,
            [identity]: {
              ...existing,
              candidates: [...unique.values()].sort((a, b) => b.finalScore - a.finalScore),
            },
          }
        })
      })
      .catch(() => {
        /* Keep the saved suggestions on expansion failure. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setExpandingKey(null)
      })
    return () => {
      controller.abort()
      setExpandingKey(null)
    }
  }, [userId, activeType, status?.enabled, filters, identity, candidates, validated])

  const refetchCandidates = useCallback(async () => {
    if (userId) invalidateDiscoveryCache(userId)
    expansionAttempts.current.clear()
    setRevision((n) => n + 1)
  }, [userId])

  const refresh = useCallback(
    async (type: MediaType) => {
      setRefreshing(true)
      const controller = new AbortController()
      const startIdentity = currentIdentity.current
      try {
        const response = await fetch(
          `/api/discovery/refresh/${type === 'movie' ? 'movies' : 'series'}`,
          {
            method: 'POST',
            credentials: 'include',
            signal: requestSignal(controller.signal, 120_000),
          }
        )
        if (!response.ok) {
          const data = await response.json()
          return { success: false, error: data.error || 'Failed to refresh' }
        }
        if (currentIdentity.current === startIdentity) await refetchCandidates()
        return { success: true }
      } catch {
        return { success: false, error: 'Could not connect to server' }
      } finally {
        setRefreshing(false)
      }
    },
    [refetchCandidates]
  )

  const markAsRequested = useCallback(
    (tmdbId: number, type: MediaType) => {
      requestRevision.current++ // A pre-request response must not overwrite the optimistic badge.
      setStatuses((prev) => ({
        userId,
        values: {
          ...(prev.userId === userId ? prev.values : {}),
          [mediaKey(type, tmdbId)]: {
            exists: false,
            status: 'pending',
            requested: true,
            requestStatus: 'pending',
          },
        },
      }))
      if (userId) invalidateDiscoveryCache(userId)
    },
    [userId]
  )

  const listFor = (type: MediaType) => lists[`${userId}:${type}:${query}`]
  return {
    status,
    movieCandidates:
      status?.enabled && activeType === 'movie' && validated
        ? (listFor('movie')?.candidates ?? EMPTY_CANDIDATES)
        : EMPTY_CANDIDATES,
    seriesCandidates:
      status?.enabled && activeType === 'series' && validated
        ? (listFor('series')?.candidates ?? EMPTY_CANDIDATES)
        : EMPTY_CANDIDATES,
    movieRun: listFor('movie')?.run ?? null,
    seriesRun: listFor('series')?.run ?? null,
    seerrStatus: statuses.userId === userId ? statuses.values : {},
    loading: Boolean(userId && activeType && !error && (!status || (status.enabled && !validated))),
    refreshing,
    expanding: expandingKey === identity,
    error,
    refresh,
    markAsRequested,
    refetchCandidates,
  }
}
