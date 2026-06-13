import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { syncUiLanguageFromServer } from '@/i18n/syncUiLanguage'
import { AuthContext, type User } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.authenticated) {
          setUser(data.user)
          setSessionError(null)
        } else {
          setUser(null)
          // Check if there was a session error (e.g., SESSION_SECRET changed)
          if (data.sessionError && data.message) {
            setSessionError(data.message)
          }
        }
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearSessionError = useCallback(() => {
    setSessionError(null)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    setUser(data.user)

    try {
      await syncUiLanguageFromServer()
    } catch {
      // ignore locale sync failures
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, login, logout, checkAuth, clearSessionError }}>
      {children}
    </AuthContext.Provider>
  )
}
