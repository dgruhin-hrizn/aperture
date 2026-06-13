import { createContext } from 'react'

export type ViewMode = 'grid' | 'list'

export type PageKey =
  | 'discovery'
  | 'topPicks'
  | 'watchHistory'
  | 'watching'
  | 'browse'
  | 'browsePeople'
  | 'recommendations'

export interface ViewModeContextValue {
  getViewMode: (page: PageKey) => ViewMode
  setViewMode: (page: PageKey, mode: ViewMode) => void
  loading: boolean
}

export const ViewModeContext = createContext<ViewModeContextValue | null>(null)
