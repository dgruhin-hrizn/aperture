/**
 * useViewMode Hook
 * 
 * Manages per-page view mode preferences (grid/list) with database persistence.
 * Uses localStorage as a cache for instant loading, syncs with server in background.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type ViewMode = 'grid' | 'list'

type PageKey = 'discovery' | 'topPicks' | 'watchHistory' | 'watching' | 'browse' | 'recommendations'

interface ViewModeContextValue {
  getViewMode: (page: PageKey) => ViewMode
  setViewMode: (page: PageKey, mode: ViewMode) => void
  loading: boolean
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null)

const DEFAULT_VIEW_MODE: ViewMode = 'grid'
const STORAGE_KEY = 'aperture-view-modes'

// Get initial state from localStorage for instant loading (no flash)
function getInitialViewModes(): Record<PageKey, ViewMode> {
  const defaults: Record<PageKey, ViewMode> = {
    discovery: DEFAULT_VIEW_MODE,
    topPicks: DEFAULT_VIEW_MODE,
    watchHistory: DEFAULT_VIEW_MODE,
    watching: DEFAULT_VIEW_MODE,
    browse: DEFAULT_VIEW_MODE,
    recommendations: DEFAULT_VIEW_MODE,
  }
  
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      return { ...defaults, ...JSON.parse(cached) }
    }
  } catch {
    // localStorage not available or invalid JSON
  }
  
  return defaults
}

interface ViewModeProviderProps {
  children: ReactNode
}

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  // Initialize from localStorage for instant load (no flash)
  const [viewModes, setViewModes] = useState<Record<PageKey, ViewMode>>(getInitialViewModes)
  const [loading, setLoading] = useState(true)

  // Fetch preferences from API on mount and sync with localStorage
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/auth/me/preferences', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          // API returns preferences at root level, not nested under 'preferences'
          if (data.viewModes) {
            const merged = {
              ...getInitialViewModes(),
              ...data.viewModes,
            }
            setViewModes(merged)
            // Update localStorage cache with server data
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            } catch {
              // localStorage not available
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch view mode preferences:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  const getViewMode = useCallback((page: PageKey): ViewMode => {
    return viewModes[page] || DEFAULT_VIEW_MODE
  }, [viewModes])

  const setViewMode = useCallback(async (page: PageKey, mode: ViewMode) => {
    // Update local state immediately for responsiveness
    setViewModes(prev => {
      const updated = { ...prev, [page]: mode }
      // Update localStorage cache immediately
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // localStorage not available
      }
      return updated
    })

    // Persist to database
    try {
      await fetch('/api/auth/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          viewModes: {
            [page]: mode,
          },
        }),
      })
    } catch (err) {
      console.error('Failed to save view mode preference:', err)
    }
  }, [])

  return (
    <ViewModeContext.Provider value={{ getViewMode, setViewMode, loading }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode(page: PageKey) {
  const context = useContext(ViewModeContext)
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider')
  }

  const viewMode = context.getViewMode(page)
  const setViewMode = useCallback(
    (mode: ViewMode) => context.setViewMode(page, mode),
    [context, page]
  )

  return {
    viewMode,
    setViewMode,
    loading: context.loading,
  }
}
