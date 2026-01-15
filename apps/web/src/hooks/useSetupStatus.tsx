import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface SetupStatus {
  needsSetup: boolean
  isAdmin: boolean
  canAccessSetup: boolean // true if needs setup OR user is admin
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

interface SetupContextType {
  status: SetupStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  markComplete: () => void
}

const SetupContext = createContext<SetupContextType | undefined>(undefined)

export function SetupProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/setup/status', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else {
        setError('Failed to check setup status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check setup status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markComplete = useCallback(() => {
    setStatus(prev => prev ? { ...prev, needsSetup: false, canAccessSetup: prev.isAdmin } : null)
  }, [])

  return (
    <SetupContext.Provider value={{ status, loading, error, refresh, markComplete }}>
      {children}
    </SetupContext.Provider>
  )
}

export function useSetupStatus() {
  const context = useContext(SetupContext)
  if (context === undefined) {
    throw new Error('useSetupStatus must be used within a SetupProvider')
  }
  return context
}

