import { useContext } from 'react'
import { SetupContext } from './setup-context'

export function useSetupStatus() {
  const context = useContext(SetupContext)
  if (context === undefined) {
    throw new Error('useSetupStatus must be used within a SetupProvider')
  }
  return context
}
