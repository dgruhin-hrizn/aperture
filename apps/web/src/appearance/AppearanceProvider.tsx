import { useUserPreferences, saveUserPreferences } from '../hooks/userPreferences'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppearanceContext } from './context'
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearancePreferences } from './preferences'

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const shared = useUserPreferences()
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const activeUser = useRef(userId)
  activeUser.current = userId
  const pendingSave = useRef<AbortController | null>(null)
  const ready = Boolean(shared.data)
  const preferences = ready ? normalizeAppearance(shared.data?.appearance) : DEFAULT_APPEARANCE

  useEffect(
    () => () => {
      pendingSave.current?.abort()
      pendingSave.current = null
    },
    [userId]
  )

  const reload = shared.reload
  const updateAppearance = useCallback(
    async (next: AppearancePreferences) => {
      if (!userId || !ready || pendingSave.current) throw new Error('Appearance is not ready')
      const controller = new AbortController()
      pendingSave.current = controller
      setSavingFor(userId)
      try {
        await saveUserPreferences(
          userId,
          { appearance: normalizeAppearance(next) },
          controller.signal
        )
      } finally {
        if (pendingSave.current === controller) pendingSave.current = null
        if (activeUser.current === userId) setSavingFor(null)
      }
    },
    [userId, ready]
  )

  return (
    <AppearanceContext.Provider
      value={{
        preferences,
        loading: shared.loading,
        saving: savingFor === userId && !!userId,
        loadError: shared.error,
        reload,
        updateAppearance,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}
