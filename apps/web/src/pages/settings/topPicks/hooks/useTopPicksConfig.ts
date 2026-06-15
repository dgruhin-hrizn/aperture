import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { PreviewCountConfig, PreviewCounts, TopPicksConfig } from '../types'

export interface UseTopPicksConfigReturn {
  config: TopPicksConfig | null
  loading: boolean
  saving: boolean
  error: string | null
  success: string | null
  hasChanges: boolean
  mdblistConfigured: boolean
  previewCounts: PreviewCounts | null
  previewLoading: boolean
  setError: (error: string | null) => void
  setSuccess: (success: string | null) => void
  updateConfig: (updates: Partial<TopPicksConfig>) => void
  handleSave: () => Promise<void>
  handleReset: () => Promise<void>
  handleRefreshNow: () => Promise<void>
}

export function useTopPicksConfig(): UseTopPicksConfigReturn {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [mdblistConfigured, setMdblistConfigured] = useState(false)
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const previewConfig = useMemo<PreviewCountConfig | null>(() => {
    if (!config) return null
    return {
      moviesPopularitySource: config.moviesPopularitySource,
      moviesMinUniqueViewers: config.moviesMinUniqueViewers,
      moviesTimeWindowDays: config.moviesTimeWindowDays,
      seriesPopularitySource: config.seriesPopularitySource,
      seriesMinUniqueViewers: config.seriesMinUniqueViewers,
      seriesTimeWindowDays: config.seriesTimeWindowDays,
    }
  }, [config])

  const checkMDBListConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/mdblist/config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setMdblistConfigured(data.configured && data.enabled)
      }
    } catch {
      setMdblistConfigured(false)
    }
  }, [])

  const fetchPreviewCounts = useCallback(async (cfg: PreviewCountConfig) => {
    const needsLocalMovies = cfg.moviesPopularitySource === 'emby_history' || cfg.moviesPopularitySource === 'hybrid'
    const needsLocalSeries = cfg.seriesPopularitySource === 'emby_history' || cfg.seriesPopularitySource === 'hybrid'
    if (!needsLocalMovies && !needsLocalSeries) {
      setPreviewCounts(null)
      return
    }

    setPreviewLoading(true)
    try {
      const response = await fetch('/api/settings/top-picks/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          moviesMinViewers: cfg.moviesMinUniqueViewers,
          moviesTimeWindowDays: cfg.moviesTimeWindowDays,
          seriesMinViewers: cfg.seriesMinUniqueViewers,
          seriesTimeWindowDays: cfg.seriesTimeWindowDays,
        }),
      })
      if (response.ok) {
        setPreviewCounts(await response.json())
      }
    } catch {
      // Silently fail preview
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!previewConfig) return
    const timeout = setTimeout(() => {
      void fetchPreviewCounts(previewConfig)
    }, 300)
    return () => clearTimeout(timeout)
  }, [previewConfig, fetchPreviewCounts])

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/top-picks')
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.fetchConfig'))
      setConfig(await response.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchConfig()
    void checkMDBListConfig()
  }, [fetchConfig, checkMDBListConfig])

  const updateConfig = useCallback((updates: Partial<TopPicksConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/top-picks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.saveConfig'))
      setSuccess(t('topPicksAdmin.success.saved'))
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally {
      setSaving(false)
    }
  }, [config, t])

  const handleReset = useCallback(async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/top-picks/reset', { method: 'POST' })
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.resetConfig'))
      setConfig(await response.json())
      setSuccess(t('topPicksAdmin.success.reset'))
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally {
      setSaving(false)
    }
  }, [t])

  const handleRefreshNow = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/refresh-top-picks/run', { method: 'POST' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('topPicksAdmin.errors.startJob'))
      }
      setSuccess(t('topPicksAdmin.success.refreshStarted'))
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    }
  }, [t])

  return {
    config,
    loading,
    saving,
    error,
    success,
    hasChanges,
    mdblistConfigured,
    previewCounts,
    previewLoading,
    setError,
    setSuccess,
    updateConfig,
    handleSave,
    handleReset,
    handleRefreshNow,
  }
}
