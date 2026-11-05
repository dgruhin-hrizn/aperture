import { useUserPreferences, saveUserPreferences } from './userPreferences'
/**
 * ViewModeProvider
 *
 * Manages per-page view mode preferences (grid/list) with database persistence.
 * Shares the account-scoped preference snapshot and persists only changed view modes.
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { ViewModeContext, type PageKey, type ViewMode } from './view-mode-context'

const DEFAULT_VIEW_MODE: ViewMode = 'grid'
function defaultViewModes(): Record<PageKey, ViewMode> {
  return {
    discovery: DEFAULT_VIEW_MODE,
    topPicks: DEFAULT_VIEW_MODE,
    watchHistory: DEFAULT_VIEW_MODE,
    watching: DEFAULT_VIEW_MODE,
    browse: DEFAULT_VIEW_MODE,
    browsePeople: 'list',
    recommendations: DEFAULT_VIEW_MODE,
  }
}

interface ViewModeProviderProps {
  children: ReactNode
}

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  const { userId, data, loading } = useUserPreferences()
  const [local, setLocal] = useState<{
    userId?: string
    modes: Partial<Record<PageKey, ViewMode>>
  }>({ modes: {} })
  const viewModes = useMemo(
    () => ({
      ...defaultViewModes(),
      ...data?.viewModes,
      ...(local.userId === userId ? local.modes : {}),
    }),
    [data?.viewModes, local, userId]
  )
  useEffect(() => {
    setLocal({ userId, modes: {} })
  }, [userId, data])

  const getViewMode = useCallback(
    (page: PageKey): ViewMode => {
      return viewModes[page] || DEFAULT_VIEW_MODE
    },
    [viewModes]
  )

  const setViewMode = useCallback(
    async (page: PageKey, mode: ViewMode) => {
      if (!userId) return
      setLocal((prev) => ({
        userId,
        modes: { ...(prev.userId === userId ? prev.modes : {}), [page]: mode },
      }))
      try {
        await saveUserPreferences(userId, { viewModes: { [page]: mode } })
      } catch (err) {
        console.error('Failed to save view mode preference:', err)
      }
    },
    [userId]
  )

  return (
    <ViewModeContext.Provider value={{ getViewMode, setViewMode, loading }}>
      {children}
    </ViewModeContext.Provider>
  )
}
