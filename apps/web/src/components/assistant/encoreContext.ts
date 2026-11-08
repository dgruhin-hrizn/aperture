import { createContext, useContext } from 'react'

export const encoreViews = [
  'chat',
  'memory',
  'plans',
  'collections',
  'curation',
  'connections',
] as const
export type EncoreView = (typeof encoreViews)[number]
export interface EncoreControl {
  open: boolean
  view: EncoreView
  openEncore: (view?: EncoreView) => void
  closeEncore: () => void
  selectView: (view: EncoreView) => void
}
export const EncoreContext = createContext<EncoreControl | null>(null)
export function useEncore() {
  const encore = useContext(EncoreContext)
  if (!encore) throw new Error('Encore controls require the application layout')
  return encore
}
