import { createContext, useContext } from 'react'
import type { AppearancePreferences } from './preferences'

export interface AppearanceContextValue {
  preferences: AppearancePreferences
  loading: boolean
  saving: boolean
  loadError: boolean
  reload: () => void
  updateAppearance: (next: AppearancePreferences) => Promise<void>
}

export const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined)

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used within AppearanceProvider')
  return context
}
