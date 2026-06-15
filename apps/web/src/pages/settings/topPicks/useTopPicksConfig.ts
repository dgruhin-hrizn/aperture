import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TopPicksConfig } from './types'

export function useTopPicksConfig() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [mdblistConfigured, setMdblistConfigured] = useState(false)

  const checkMDBListConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/mdblist/config', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as { configured?: boolean; enabled?: boolean }
        setMdblistConfigured(Boolean(data.configured && data.enabled))
      }
    } catch { setMdblistConfigured(false) }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/top-picks')
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.fetchConfig'))
      setConfig((await response.json()) as TopPicksConfig)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { void fetchConfig(); void checkMDBListConfig() }, [fetchConfig, checkMDBListConfig])

  const updateConfig = useCallback((updates: Partial<TopPicksConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!config) return
    try {
      setSaving(true); setError(null)
      const response = await fetch('/api/settings/top-picks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.saveConfig'))
      setSuccess(t('topPicksAdmin.success.saved')); setHasChanges(false); setTimeout(() => setSuccess(null), 3000)
    } catch (err) { setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown')) } finally { setSaving(false) }
  }, [config, t])

  const handleReset = useCallback(async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/top-picks/reset', { method: 'POST' })
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.resetConfig'))
      setConfig((await response.json()) as TopPicksConfig)
      setSuccess(t('topPicksAdmin.success.reset')); setHasChanges(false); setTimeout(() => setSuccess(null), 3000)
    } catch (err) { setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown')) } finally { setSaving(false) }
  }, [t])

  const handleRefreshNow = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/refresh-top-picks/run', { method: 'POST' })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || t('topPicksAdmin.errors.startJob'))
      }
      setSuccess(t('topPicksAdmin.success.refreshStarted')); setTimeout(() => setSuccess(null), 3000)
    } catch (err) { setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown')) }
  }, [t])

  return { config, loading, saving, error, success, hasChanges, mdblistConfigured, setError, setSuccess, updateConfig, handleSave, handleReset, handleRefreshNow }
}
