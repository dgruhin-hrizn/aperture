/**
 * useViewMode Hook
 *
 * Hook for accessing per-page view mode preferences.
 */

import { useContext, useCallback } from 'react'
import { ViewModeContext, type PageKey, type ViewMode } from './view-mode-context'

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
