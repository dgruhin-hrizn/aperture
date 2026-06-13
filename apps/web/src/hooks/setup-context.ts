import { createContext } from 'react'

export interface SetupStatus {
  needsSetup: boolean
  isAdmin: boolean
  canAccessSetup: boolean // true if needs setup OR user is admin
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

export interface SetupContextType {
  status: SetupStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  markComplete: () => void
}

export const SetupContext = createContext<SetupContextType | undefined>(undefined)
