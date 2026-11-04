import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppearanceContext } from './context'
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearancePreferences } from './preferences'

interface LoadedAppearance {
  userId: string
  preferences: AppearancePreferences
  ready: boolean
  error: boolean
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<LoadedAppearance | null>(null)
  const [revision, setRevision] = useState(0)
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const activeUser = useRef(userId)
  activeUser.current = userId
  const pendingSave = useRef<AbortController | null>(null)
  const current = state?.userId === userId ? state : null
  const preferences = current?.preferences ?? DEFAULT_APPEARANCE

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/auth/me/preferences', {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Could not load appearance')
        const data = await response.json()
        if (!controller.signal.aborted) {
          setState({
            userId: userId!,
            preferences: normalizeAppearance(data.appearance),
            ready: true,
            error: false,
          })
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ userId: userId!, preferences: DEFAULT_APPEARANCE, ready: false, error: true })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [userId, revision])

  useEffect(
    () => () => {
      pendingSave.current?.abort()
      pendingSave.current = null
    },
    [userId]
  )

  const reload = useCallback(() => setRevision((n) => n + 1), [])
  const updateAppearance = useCallback(
    async (next: AppearancePreferences) => {
      if (!userId || !current?.ready || pendingSave.current)
        throw new Error('Appearance is not ready')
      const controller = new AbortController()
      pendingSave.current = controller
      setSavingFor(userId)
      try {
        const response = await fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          // Send only the appearance pair, never a snapshot of unrelated user settings.
          body: JSON.stringify({ appearance: normalizeAppearance(next) }),
        })
        if (!response.ok) throw new Error('Could not save appearance')
        const result = await response.json()
        if (!controller.signal.aborted && activeUser.current === userId) {
          setState({
            userId,
            preferences: normalizeAppearance(result.appearance),
            ready: true,
            error: false,
          })
        }
      } finally {
        if (pendingSave.current === controller) pendingSave.current = null
        if (activeUser.current === userId) setSavingFor(null)
      }
    },
    [userId, current]
  )

  return (
    <AppearanceContext.Provider
      value={{
        preferences,
        loading: !!userId && !current,
        saving: savingFor === userId && !!userId,
        loadError: current?.error ?? false,
        reload,
        updateAppearance,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}
