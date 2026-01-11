/**
 * useWatching Hook
 *
 * Hook for accessing the watching context.
 */

import { useContext } from 'react'
import { WatchingContext } from './WatchingContext'

export { WatchingProvider } from './WatchingContext'
export type { WatchingContextValue } from './WatchingContext'

export function useWatching() {
  const context = useContext(WatchingContext)
  if (!context) {
    throw new Error('useWatching must be used within a WatchingProvider')
  }
  return context
}
