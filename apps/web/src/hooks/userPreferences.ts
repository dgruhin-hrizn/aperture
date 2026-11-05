import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  cachedResource,
  invalidateCachedResource,
  peekCachedResource,
  setCachedResource,
} from './cachedResource'
import { apiFetch } from '../lib/api'

export interface UserPreferences {
  appearance?: { theme: string; mode: string }
  dismissedWelcomeTourVersion?: number
  viewModes?: Record<string, 'grid' | 'list'>
  uiLanguage?: string | null
  aiLanguage?: string | null
  similarMediaView?: 'graph' | 'list'
  sidebarCollapsed?: boolean
  effectiveUiLanguage?: string
  effectiveAiLanguage?: string
  [key: string]: unknown
}
const endpoint = '/api/auth/me/preferences'
const eventName = 'aperture:preferences-changed'

export function loadUserPreferences(userId: string, signal: AbortSignal) {
  return cachedResource<UserPreferences>(userId, endpoint, signal, 30_000)
}

/** Save only the changed keys; the server merges supported nested preferences. */
async function performPreferenceSave(
  userId: string,
  patch: Record<string, unknown>,
  signal?: AbortSignal
) {
  const response = await apiFetch(endpoint, {
    method: 'PATCH',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error('Could not save preferences')
  const preferences = (await response.json()) as UserPreferences
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  setCachedResource(userId, endpoint, preferences)
  window.dispatchEvent(new CustomEvent(eventName, { detail: { userId } }))
  return preferences
}

export function useUserPreferences() {
  const { user } = useAuth()
  const userId = user?.id
  const [state, setState] = useState<{
    userId: string
    data?: UserPreferences
    error?: boolean
  } | null>(() => {
    const data = userId ? peekCachedResource<UserPreferences>(userId, endpoint) : undefined
    return userId && data ? { userId, data } : null
  })
  const [revision, setRevision] = useState(0)
  const current = state?.userId === userId ? state : null
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    void loadUserPreferences(userId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ userId, data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ userId, error: true })
      })
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail.userId === userId)
        setRevision((n) => n + 1)
    }
    window.addEventListener(eventName, changed)
    return () => {
      controller.abort()
      window.removeEventListener(eventName, changed)
    }
  }, [userId, revision])
  const reload = useCallback(() => {
    if (userId) invalidateCachedResource(userId, endpoint)
    setRevision((n) => n + 1)
  }, [userId])
  return {
    userId,
    data: current?.data,
    loading: Boolean(userId && !current),
    error: current?.error ?? false,
    reload,
  }
}

const pendingWrites = new Map<string, Promise<UserPreferences>>()
export function saveUserPreferences(
  userId: string,
  patch: Record<string, unknown>,
  signal?: AbortSignal
) {
  const previous = pendingWrites.get(userId) ?? Promise.resolve()
  const request = previous
    .catch(() => {})
    .then(() => {
      signal?.throwIfAborted()
      return performPreferenceSave(userId, patch, signal)
    })
  pendingWrites.set(userId, request)
  void request
    .finally(() => {
      if (pendingWrites.get(userId) === request) pendingWrites.delete(userId)
    })
    .catch(() => {})
  return request
}
