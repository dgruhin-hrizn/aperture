import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { SetupContext, type SetupStatus } from './setup-context'

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
