import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface TraktStatus {
  traktConfigured: boolean
  connected: boolean
  username: string | null
  syncedAt: string | null
}

export interface TraktMessage {
  type: 'success' | 'error'
  text: string
}

export function useTraktIntegration() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<TraktStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<TraktMessage | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/trakt/status', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as TraktStatus
        setStatus(data)
      }
    } catch {
      // Optional load failures may degrade gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      const response = await fetch('/api/trakt/auth-url', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as { authUrl: string }
        window.location.href = data.authUrl
        return
      }
      const err = (await response.json().catch(() => ({}))) as { error?: string }
      setMessage({ type: 'error', text: err.error || t('userSettings.traktErrStart') })
    } catch {
      setMessage({ type: 'error', text: t('userSettings.errConnectServer') })
    }
  }, [t])

  const disconnect = useCallback(async () => {
    try {
      const response = await fetch('/api/trakt/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        setStatus((prev) =>
          prev ? { ...prev, connected: false, username: null, syncedAt: null } : null
        )
        setMessage({ type: 'success', text: t('userSettings.traktDisconnected') })
        window.setTimeout(() => setMessage(null), 3000)
        return
      }
      const err = (await response.json().catch(() => ({}))) as { error?: string }
      setMessage({ type: 'error', text: err.error || t('userSettings.traktErrDisconnect') })
    } catch {
      setMessage({ type: 'error', text: t('userSettings.traktErrDisconnect') })
    }
  }, [t])

  const syncRatings = useCallback(async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/trakt/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = (await response.json()) as { message: string }
        setMessage({ type: 'success', text: data.message })
        await fetchStatus()
        return
      }
      const err = (await response.json().catch(() => ({}))) as { error?: string }
      setMessage({ type: 'error', text: err.error || t('userSettings.traktErrSync') })
    } catch {
      setMessage({ type: 'error', text: t('userSettings.errConnectServer') })
    } finally {
      setSyncing(false)
    }
  }, [fetchStatus, t])

  const handleCallbackFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (params.get('trakt') === 'success') {
      const username = params.get('username')
      setMessage({
        type: 'success',
        text: t('userSettings.traktSuccessConnect', { username: username ?? '' }),
      })
      void fetchStatus()
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
      return
    }
    if (params.get('trakt') === 'error') {
      const callbackMessage = params.get('message') || t('userSettings.traktErrUnknown')
      setMessage({ type: 'error', text: t('userSettings.traktFailConnect', { message: callbackMessage }) })
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
  }, [fetchStatus, t])

  return {
    status,
    loading,
    syncing,
    message,
    setMessage,
    fetchStatus,
    connect,
    disconnect,
    syncRatings,
    handleCallbackFromUrl,
  }
}
