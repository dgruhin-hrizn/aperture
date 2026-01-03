import { useEffect, useState } from 'react'
import type {
  LibraryConfig,
  RecommendationConfig,
  PurgeStats,
  UserSettings,
  EmbeddingModelConfig,
} from '../types'

export function useSettingsData(isAdmin: boolean) {
  const [libraries, setLibraries] = useState<LibraryConfig[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(false)
  const [syncingLibraries, setSyncingLibraries] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [updatingLibrary, setUpdatingLibrary] = useState<string | null>(null)

  // Recommendation config state
  const [recConfig, setRecConfig] = useState<RecommendationConfig | null>(null)
  const [loadingRecConfig, setLoadingRecConfig] = useState(false)
  const [savingRecConfig, setSavingRecConfig] = useState(false)
  const [recConfigError, setRecConfigError] = useState<string | null>(null)
  const [recConfigSuccess, setRecConfigSuccess] = useState<string | null>(null)
  const [recConfigDirty, setRecConfigDirty] = useState(false)

  // Purge state
  const [purgeStats, setPurgeStats] = useState<PurgeStats | null>(null)
  const [loadingPurgeStats, setLoadingPurgeStats] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)

  // User settings state
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [defaultLibraryPrefix, setDefaultLibraryPrefix] = useState<string>('AI Picks - ')
  const [loadingUserSettings, setLoadingUserSettings] = useState(false)
  const [savingUserSettings, setSavingUserSettings] = useState(false)
  const [userSettingsError, setUserSettingsError] = useState<string | null>(null)
  const [userSettingsSuccess, setUserSettingsSuccess] = useState<string | null>(null)
  const [libraryNameInput, setLibraryNameInput] = useState<string>('')

  // Embedding model state
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingModelConfig | null>(null)
  const [loadingEmbeddingModel, setLoadingEmbeddingModel] = useState(false)

  // Fetch configs on mount
  useEffect(() => {
    fetchLibraries()
    fetchUserSettings()
    if (isAdmin) {
      fetchRecConfig()
      fetchPurgeStats()
      fetchEmbeddingModel()
    }
  }, [isAdmin])

  const fetchEmbeddingModel = async () => {
    setLoadingEmbeddingModel(true)
    try {
      const response = await fetch('/api/settings/embedding-model', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setEmbeddingConfig(data)
      }
    } catch {
      // Silently fail - this is just status display
    } finally {
      setLoadingEmbeddingModel(false)
    }
  }

  const fetchPurgeStats = async () => {
    setLoadingPurgeStats(true)
    try {
      const response = await fetch('/api/admin/purge/stats', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPurgeStats(data.stats)
      }
    } catch {
      // Silently fail - stats are optional
    } finally {
      setLoadingPurgeStats(false)
    }
  }

  const fetchUserSettings = async () => {
    setLoadingUserSettings(true)
    setUserSettingsError(null)
    try {
      const response = await fetch('/api/settings/user', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings)
        setDefaultLibraryPrefix(data.defaults?.libraryNamePrefix || 'AI Picks - ')
        setLibraryNameInput(data.settings.libraryName || '')
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to load user settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setLoadingUserSettings(false)
    }
  }

  const saveUserSettings = async () => {
    setSavingUserSettings(true)
    setUserSettingsError(null)
    setUserSettingsSuccess(null)
    try {
      const response = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          libraryName: libraryNameInput.trim() || null,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings)
        setUserSettingsSuccess('Library name saved! It will be used for future library updates.')
        setTimeout(() => setUserSettingsSuccess(null), 5000)
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to save settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setSavingUserSettings(false)
    }
  }

  const executePurge = async () => {
    setPurging(true)
    setPurgeError(null)
    setPurgeSuccess(null)
    try {
      const response = await fetch('/api/admin/purge/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      })
      if (response.ok) {
        const data = await response.json()
        setPurgeSuccess(`Purged: ${data.result.moviesDeleted} movies, ${data.result.embeddingsDeleted} embeddings, ${data.result.watchHistoryDeleted} watch history entries`)
        setShowPurgeConfirm(false)
        // Refresh stats
        fetchPurgeStats()
      } else {
        const err = await response.json()
        setPurgeError(err.error || 'Failed to purge database')
      }
    } catch {
      setPurgeError('Could not connect to server')
    } finally {
      setPurging(false)
    }
  }

  const fetchRecConfig = async () => {
    setLoadingRecConfig(true)
    setRecConfigError(null)
    try {
      const response = await fetch('/api/settings/recommendations', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to load recommendation config')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setLoadingRecConfig(false)
    }
  }

  const saveRecConfig = async () => {
    if (!recConfig) return
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maxCandidates: recConfig.maxCandidates,
          selectedCount: recConfig.selectedCount,
          recentWatchLimit: recConfig.recentWatchLimit,
          similarityWeight: recConfig.similarityWeight,
          noveltyWeight: recConfig.noveltyWeight,
          ratingWeight: recConfig.ratingWeight,
          diversityWeight: recConfig.diversityWeight,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
        setRecConfigSuccess('Configuration saved! Changes apply to next recommendation run.')
        setTimeout(() => setRecConfigSuccess(null), 5000)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to save configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }

  const resetRecConfig = async () => {
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendations/reset', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
        setRecConfigSuccess('Configuration reset to defaults!')
        setTimeout(() => setRecConfigSuccess(null), 5000)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to reset configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }

  const updateRecConfigField = <K extends keyof RecommendationConfig>(
    field: K,
    value: RecommendationConfig[K]
  ) => {
    if (!recConfig) return
    setRecConfig({ ...recConfig, [field]: value })
    setRecConfigDirty(true)
  }

  const fetchLibraries = async () => {
    setLoadingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries)
      } else {
        const err = await response.json()
        setLibraryError(err.error || 'Failed to load libraries')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setLoadingLibraries(false)
    }
  }

  const syncLibrariesFromServer = async () => {
    setSyncingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries)
      } else {
        const err = await response.json()
        setLibraryError(err.error || 'Failed to sync libraries')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setSyncingLibraries(false)
    }
  }

  const toggleLibraryEnabled = async (providerLibraryId: string, isEnabled: boolean) => {
    setUpdatingLibrary(providerLibraryId)
    try {
      const response = await fetch(`/api/settings/libraries/${providerLibraryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled }),
      })
      if (response.ok) {
        setLibraries((prev) =>
          prev.map((lib) =>
            lib.providerLibraryId === providerLibraryId ? { ...lib, isEnabled } : lib
          )
        )
      }
    } catch {
      // Revert on error
      setLibraries((prev) =>
        prev.map((lib) =>
          lib.providerLibraryId === providerLibraryId ? { ...lib, isEnabled: !isEnabled } : lib
        )
      )
    } finally {
      setUpdatingLibrary(null)
    }
  }

  return {
    // Library state
    libraries,
    loadingLibraries,
    syncingLibraries,
    libraryError,
    updatingLibrary,
    syncLibrariesFromServer,
    toggleLibraryEnabled,

    // Recommendation config state
    recConfig,
    loadingRecConfig,
    savingRecConfig,
    recConfigError,
    setRecConfigError,
    recConfigSuccess,
    setRecConfigSuccess,
    recConfigDirty,
    saveRecConfig,
    resetRecConfig,
    updateRecConfigField,

    // Purge state
    purgeStats,
    loadingPurgeStats,
    purging,
    purgeError,
    setPurgeError,
    purgeSuccess,
    setPurgeSuccess,
    showPurgeConfirm,
    setShowPurgeConfirm,
    executePurge,

    // User settings state
    userSettings,
    defaultLibraryPrefix,
    loadingUserSettings,
    savingUserSettings,
    userSettingsError,
    setUserSettingsError,
    userSettingsSuccess,
    setUserSettingsSuccess,
    libraryNameInput,
    setLibraryNameInput,
    saveUserSettings,

    // Embedding model state
    embeddingConfig,
    loadingEmbeddingModel,
  }
}

