import { useState, useEffect, useCallback } from 'react'

interface MediaTypeConfig {
  maxCandidates: number
  selectedCount: number
  recentWatchLimit: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
}

interface RecommendationConfig {
  movie: MediaTypeConfig
  series: MediaTypeConfig
  updatedAt: string
}

const DEFAULT_CONFIG: MediaTypeConfig = {
  maxCandidates: 10000,
  selectedCount: 50,
  recentWatchLimit: 50,
  similarityWeight: 0.45,
  noveltyWeight: 0.15,
  ratingWeight: 0.25,
  diversityWeight: 0.15,
}

export function useRecommendationConfig() {
  const [recConfig, setRecConfig] = useState<RecommendationConfig | null>(null)
  const [loadingRecConfig, setLoadingRecConfig] = useState(false)
  const [savingRecConfig, setSavingRecConfig] = useState(false)
  const [recConfigError, setRecConfigError] = useState<string | null>(null)
  const [recConfigSuccess, setRecConfigSuccess] = useState<string | null>(null)

  // Track original values for dirty checking
  const [originalMovieConfig, setOriginalMovieConfig] = useState<MediaTypeConfig | null>(null)
  const [originalSeriesConfig, setOriginalSeriesConfig] = useState<MediaTypeConfig | null>(null)

  const fetchRecConfig = useCallback(async () => {
    setLoadingRecConfig(true)
    try {
      const response = await fetch('/api/settings/recommendation-config', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setOriginalMovieConfig({ ...data.config.movie })
        setOriginalSeriesConfig({ ...data.config.series })
      }
    } catch {
      setRecConfigError('Failed to load recommendation configuration')
    } finally {
      setLoadingRecConfig(false)
    }
  }, [])

  useEffect(() => {
    fetchRecConfig()
  }, [fetchRecConfig])

  const movieConfigDirty = recConfig && originalMovieConfig
    ? JSON.stringify(recConfig.movie) !== JSON.stringify(originalMovieConfig)
    : false

  const seriesConfigDirty = recConfig && originalSeriesConfig
    ? JSON.stringify(recConfig.series) !== JSON.stringify(originalSeriesConfig)
    : false

  const updateMovieConfigField = useCallback(<K extends keyof MediaTypeConfig>(
    field: K,
    value: MediaTypeConfig[K]
  ) => {
    setRecConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        movie: { ...prev.movie, [field]: value },
      }
    })
  }, [])

  const updateSeriesConfigField = useCallback(<K extends keyof MediaTypeConfig>(
    field: K,
    value: MediaTypeConfig[K]
  ) => {
    setRecConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        series: { ...prev.series, [field]: value },
      }
    })
  }, [])

  const saveMovieConfig = useCallback(async () => {
    if (!recConfig) return
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendation-config/movie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(recConfig.movie),
      })
      if (response.ok) {
        setRecConfigSuccess('Movie recommendation settings saved!')
        setOriginalMovieConfig({ ...recConfig.movie })
        setTimeout(() => setRecConfigSuccess(null), 3000)
      } else {
        const data = await response.json()
        setRecConfigError(data.error || 'Failed to save movie configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }, [recConfig])

  const saveSeriesConfig = useCallback(async () => {
    if (!recConfig) return
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendation-config/series', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(recConfig.series),
      })
      if (response.ok) {
        setRecConfigSuccess('Series recommendation settings saved!')
        setOriginalSeriesConfig({ ...recConfig.series })
        setTimeout(() => setRecConfigSuccess(null), 3000)
      } else {
        const data = await response.json()
        setRecConfigError(data.error || 'Failed to save series configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }, [recConfig])

  const resetMovieConfig = useCallback(() => {
    setRecConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        movie: { ...DEFAULT_CONFIG },
      }
    })
  }, [])

  const resetSeriesConfig = useCallback(() => {
    setRecConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        series: { ...DEFAULT_CONFIG },
      }
    })
  }, [])

  return {
    recConfig,
    loadingRecConfig,
    savingRecConfig,
    recConfigError,
    setRecConfigError,
    recConfigSuccess,
    setRecConfigSuccess,
    movieConfigDirty,
    seriesConfigDirty,
    saveMovieConfig,
    saveSeriesConfig,
    resetMovieConfig,
    resetSeriesConfig,
    updateMovieConfigField,
    updateSeriesConfigField,
  }
}

