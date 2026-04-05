import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Slider,
  Button,
  Alert,
  Grid,
  Chip,
  CircularProgress,
  Stack,
  InputAdornment,
  Checkbox,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Collapse,
  List,
  ListItem,
  ListItemText,
  InputLabel,
  OutlinedInput,
} from '@mui/material'
import { MDBListSelector } from './MDBListSelector'
import { TopPicksPreviewModal } from './TopPicksPreviewModal'
import { LibraryMatchPreview } from './LibraryMatchPreview'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestoreIcon from '@mui/icons-material/Restore'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import GroupIcon from '@mui/icons-material/Group'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FolderIcon from '@mui/icons-material/Folder'
import CollectionsIcon from '@mui/icons-material/Collections'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import OutputIcon from '@mui/icons-material/Output'
import ImageIcon from '@mui/icons-material/Image'
import PublicIcon from '@mui/icons-material/Public'
import HomeIcon from '@mui/icons-material/Home'
import MergeIcon from '@mui/icons-material/Merge'
import SendIcon from '@mui/icons-material/Send'
import { ImageUpload } from '../../../components/ImageUpload'
import { DEFAULT_LIBRARY_IMAGES } from '../../setup/constants'
import TranslateIcon from '@mui/icons-material/Translate'

// Common languages for quick selection
const COMMON_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru']

// All ISO 639-1 codes we have display names for (see topPicksAdmin.languages.*)
const KNOWN_LANGUAGE_CODES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru',
  'ar', 'hi', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'tr', 'th', 'id', 'vi', 'cs', 'el', 'he', 'hu', 'ro', 'uk',
  'bn', 'ta', 'te', 'ml', 'mr', 'gu', 'kn', 'pa', 'tl', 'ms', 'fa', 'ur', 'cn',
]

// All available popularity sources
type PopularitySource = 
  | 'emby_history'      // Local watch history (renamed from 'local')
  | 'tmdb_popular'      // TMDB most popular
  | 'tmdb_trending_day' // TMDB trending today
  | 'tmdb_trending_week'// TMDB trending this week
  | 'tmdb_top_rated'    // TMDB highest rated
  | 'mdblist'           // User-selected MDBList
  | 'hybrid'            // Local + one external source

// External sources that can be used in hybrid mode
type HybridExternalSource = 
  | 'tmdb_popular'
  | 'tmdb_trending_day'
  | 'tmdb_trending_week'
  | 'tmdb_top_rated'
  | 'mdblist'

interface TopPicksConfig {
  isEnabled: boolean
  // Movies-specific settings
  moviesPopularitySource: PopularitySource
  moviesTimeWindowDays: number
  moviesMinUniqueViewers: number
  moviesUseAllMatches: boolean
  moviesCount: number
  moviesHybridExternalSource: HybridExternalSource
  // Series-specific settings
  seriesPopularitySource: PopularitySource
  seriesTimeWindowDays: number
  seriesMinUniqueViewers: number
  seriesUseAllMatches: boolean
  seriesCount: number
  seriesHybridExternalSource: HybridExternalSource
  // Shared weights
  uniqueViewersWeight: number
  playCountWeight: number
  completionWeight: number
  refreshCron: string
  lastRefreshedAt: string | null
  moviesLibraryName: string
  seriesLibraryName: string
  // Output format settings (separate for movies and series)
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
  // Movies output modes
  moviesLibraryEnabled: boolean
  moviesCollectionEnabled: boolean
  moviesPlaylistEnabled: boolean
  // Series output modes
  seriesLibraryEnabled: boolean
  seriesCollectionEnabled: boolean
  seriesPlaylistEnabled: boolean
  // Collection/Playlist names
  moviesCollectionName: string
  seriesCollectionName: string
  // MDBList list selections
  mdblistMoviesListId: number | null
  mdblistSeriesListId: number | null
  mdblistMoviesListName: string | null
  mdblistSeriesListName: string | null
  // MDBList sort order
  mdblistMoviesSort: string
  mdblistSeriesSort: string
  // Hybrid mode weights
  hybridLocalWeight: number
  hybridExternalWeight: number
  // Auto-request settings
  moviesAutoRequestEnabled: boolean
  moviesAutoRequestLimit: number
  seriesAutoRequestEnabled: boolean
  seriesAutoRequestLimit: number
  autoRequestCron: string
  // Language filters
  moviesLanguages: string[]
  moviesIncludeUnknownLanguage: boolean
  seriesLanguages: string[]
  seriesIncludeUnknownLanguage: boolean
}

interface PreviewCounts {
  movies: number
  series: number
  recommendedMoviesMinViewers: number
  recommendedSeriesMinViewers: number
}

interface LibraryImageInfo {
  url?: string
  isDefault?: boolean
}

interface SortOption {
  value: string
  label: string
}

interface LibraryMatchResult {
  total: number
  matched: number
  missing: Array<{
    title: string
    year: number | null
    tmdbid?: number
    imdbid?: string
    mediatype: string
  }>
}

// Source options for dropdown
interface SourceOption {
  value: PopularitySource
  label: string
  description: string
  icon: 'home' | 'tmdb' | 'mdblist' | 'hybrid'
  requiresMdblist?: boolean
}

// External sources for hybrid mode
interface HybridSourceOption {
  value: HybridExternalSource
  label: string
  requiresMdblist?: boolean
}

const RECOMMENDED_DIMENSIONS = {
  width: 1920,
  height: 1080,
}

export function TopPicksSection() {
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Image state - initialize with bundled defaults
  const [images, setImages] = useState<Record<string, LibraryImageInfo>>({
    'top-picks-movies': { url: DEFAULT_LIBRARY_IMAGES['top-picks-movies'], isDefault: true },
    'top-picks-series': { url: DEFAULT_LIBRARY_IMAGES['top-picks-series'], isDefault: true },
  })
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  // MDBList state
  const [mdblistConfigured, setMdblistConfigured] = useState(false)

  // Preview counts state
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // MDBList item counts state
  const [moviesListCounts, setMoviesListCounts] = useState<{ total: number } | null>(null)
  const [seriesListCounts, setSeriesListCounts] = useState<{ total: number } | null>(null)

  // Library match state
  const [moviesLibraryMatch, setMoviesLibraryMatch] = useState<LibraryMatchResult | null>(null)
  const [seriesLibraryMatch, setSeriesLibraryMatch] = useState<LibraryMatchResult | null>(null)
  const [moviesMatchLoading, setMoviesMatchLoading] = useState(false)
  const [seriesMatchLoading, setSeriesMatchLoading] = useState(false)
  const [moviesMatchExpanded, setMoviesMatchExpanded] = useState(false)
  const [seriesMatchExpanded, setSeriesMatchExpanded] = useState(false)

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewModalMediaType, setPreviewModalMediaType] = useState<'movies' | 'series'>('movies')

  const { t } = useTranslation()

  const getLanguageName = useCallback(
    (code: string) => t(`topPicksAdmin.languages.${code}`, { defaultValue: code.toUpperCase() }),
    [t]
  )

  const extendedLanguageCodes = useMemo(
    () =>
      KNOWN_LANGUAGE_CODES.filter((code) => !COMMON_LANGUAGES.includes(code)).sort((a, b) =>
        getLanguageName(a).localeCompare(getLanguageName(b))
      ),
    [getLanguageName]
  )

  const sortOptions = useMemo<SortOption[]>(
    () => [
      { value: 'score', label: t('topPicksAdmin.sortOptions.score') },
      { value: 'score_average', label: t('topPicksAdmin.sortOptions.score_average') },
      { value: 'imdbrating', label: t('topPicksAdmin.sortOptions.imdbrating') },
      { value: 'imdbvotes', label: t('topPicksAdmin.sortOptions.imdbvotes') },
      { value: 'imdbpopular', label: t('topPicksAdmin.sortOptions.imdbpopular') },
      { value: 'tmdbpopular', label: t('topPicksAdmin.sortOptions.tmdbpopular') },
      { value: 'rtomatoes', label: t('topPicksAdmin.sortOptions.rtomatoes') },
      { value: 'metacritic', label: t('topPicksAdmin.sortOptions.metacritic') },
    ],
    [t]
  )

  const sourceOptions = useMemo<SourceOption[]>(
    () => [
      {
        value: 'emby_history',
        label: t('topPicksAdmin.sources.emby_history.label'),
        description: t('topPicksAdmin.sources.emby_history.description'),
        icon: 'home',
      },
      {
        value: 'tmdb_popular',
        label: t('topPicksAdmin.sources.tmdb_popular.label'),
        description: t('topPicksAdmin.sources.tmdb_popular.description'),
        icon: 'tmdb',
      },
      {
        value: 'tmdb_trending_day',
        label: t('topPicksAdmin.sources.tmdb_trending_day.label'),
        description: t('topPicksAdmin.sources.tmdb_trending_day.description'),
        icon: 'tmdb',
      },
      {
        value: 'tmdb_trending_week',
        label: t('topPicksAdmin.sources.tmdb_trending_week.label'),
        description: t('topPicksAdmin.sources.tmdb_trending_week.description'),
        icon: 'tmdb',
      },
      {
        value: 'tmdb_top_rated',
        label: t('topPicksAdmin.sources.tmdb_top_rated.label'),
        description: t('topPicksAdmin.sources.tmdb_top_rated.description'),
        icon: 'tmdb',
      },
      {
        value: 'mdblist',
        label: t('topPicksAdmin.sources.mdblist.label'),
        description: t('topPicksAdmin.sources.mdblist.description'),
        icon: 'mdblist',
        requiresMdblist: true,
      },
      {
        value: 'hybrid',
        label: t('topPicksAdmin.sources.hybrid.label'),
        description: t('topPicksAdmin.sources.hybrid.description'),
        icon: 'hybrid',
      },
    ],
    [t]
  )

  const hybridExternalOptions = useMemo<HybridSourceOption[]>(
    () => [
      { value: 'tmdb_popular', label: t('topPicksAdmin.sources.tmdb_popular.label') },
      { value: 'tmdb_trending_day', label: t('topPicksAdmin.sources.tmdb_trending_day.label') },
      { value: 'tmdb_trending_week', label: t('topPicksAdmin.sources.tmdb_trending_week.label') },
      { value: 'tmdb_top_rated', label: t('topPicksAdmin.sources.tmdb_top_rated.label') },
      { value: 'mdblist', label: t('topPicksAdmin.sources.mdblist.label'), requiresMdblist: true },
    ],
    [t]
  )

  // Fetch MDBList item counts when list selection changes
  const fetchListCounts = useCallback(async (listId: number | null, type: 'movies' | 'series') => {
    if (!listId) {
      if (type === 'movies') setMoviesListCounts(null)
      else setSeriesListCounts(null)
      return
    }

    try {
      const response = await fetch(`/api/mdblist/lists/${listId}/counts`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (type === 'movies') setMoviesListCounts(data)
        else setSeriesListCounts(data)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Fetch library match for MDBList sources
  const fetchLibraryMatch = useCallback(async (listId: number | null, type: 'movies' | 'series', sort: string) => {
    if (!listId) {
      if (type === 'movies') setMoviesLibraryMatch(null)
      else setSeriesLibraryMatch(null)
      return
    }

    if (type === 'movies') setMoviesMatchLoading(true)
    else setSeriesMatchLoading(true)

    try {
      const mediatype = type === 'movies' ? 'movie' : 'show'
      const response = await fetch(`/api/mdblist/lists/${listId}/library-match?mediatype=${mediatype}&sort=${sort}`, { 
        credentials: 'include' 
      })
      if (response.ok) {
        const data = await response.json()
        if (type === 'movies') setMoviesLibraryMatch(data)
        else setSeriesLibraryMatch(data)
      }
    } catch {
      // Silently fail
    } finally {
      if (type === 'movies') setMoviesMatchLoading(false)
      else setSeriesMatchLoading(false)
    }
  }, [])

  // Fetch source preview for any source type (TMDB, MDBList, etc.)
  const fetchSourcePreview = useCallback(async (
    type: 'movies' | 'series',
    source: PopularitySource,
    hybridExternalSource?: HybridExternalSource,
    mdblistListId?: number | null,
    mdblistSort?: string,
    languages?: string[],
    includeUnknownLanguage?: boolean
  ) => {
    // Skip for emby_history - no external source to preview
    if (source === 'emby_history') {
      if (type === 'movies') setMoviesLibraryMatch(null)
      else setSeriesLibraryMatch(null)
      return
    }

    // For MDBList, use the existing endpoint (it's faster)
    if (source === 'mdblist' && mdblistListId) {
      fetchLibraryMatch(mdblistListId, type, mdblistSort || 'score')
      return
    }

    // For TMDB sources or hybrid mode, use the preview endpoint
    if (type === 'movies') setMoviesMatchLoading(true)
    else setSeriesMatchLoading(true)

    try {
      const response = await fetch('/api/top-picks/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mediaType: type,
          source,
          hybridExternalSource,
          mdblistListId,
          mdblistSort,
          limit: 100,
          languages: languages || [],
          includeUnknownLanguage: includeUnknownLanguage ?? true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const result: LibraryMatchResult = {
          total: data.matched.length + data.missing.length,
          matched: data.matched.length,
          missing: data.missing.map((item: { title: string; year: number | null }) => ({
            title: item.title,
            year: item.year,
          })),
        }
        if (type === 'movies') setMoviesLibraryMatch(result)
        else setSeriesLibraryMatch(result)
      }
    } catch {
      // Silently fail
    } finally {
      if (type === 'movies') setMoviesMatchLoading(false)
      else setSeriesMatchLoading(false)
    }
  }, [fetchLibraryMatch])

  // Fetch counts when list IDs change
  useEffect(() => {
    if (config?.mdblistMoviesListId) {
      fetchListCounts(config.mdblistMoviesListId, 'movies')
    } else {
      setMoviesListCounts(null)
    }
  }, [config?.mdblistMoviesListId, fetchListCounts])

  useEffect(() => {
    if (config?.mdblistSeriesListId) {
      fetchListCounts(config.mdblistSeriesListId, 'series')
    } else {
      setSeriesListCounts(null)
    }
  }, [config?.mdblistSeriesListId, fetchListCounts])

  // Fetch source preview when source or related settings change (debounced)
  useEffect(() => {
    if (!config) return
    
    const source = config.moviesPopularitySource
    // Skip emby_history - nothing to preview
    if (source === 'emby_history') {
      setMoviesLibraryMatch(null)
      return
    }
    
    const timeout = setTimeout(() => {
      fetchSourcePreview(
        'movies',
        source,
        config.moviesHybridExternalSource,
        config.mdblistMoviesListId,
        config.mdblistMoviesSort,
        config.moviesLanguages,
        config.moviesIncludeUnknownLanguage
      )
    }, 500)
    return () => clearTimeout(timeout)
  }, [
    config?.moviesPopularitySource,
    config?.moviesHybridExternalSource,
    config?.mdblistMoviesListId,
    config?.mdblistMoviesSort,
    config?.moviesLanguages,
    config?.moviesIncludeUnknownLanguage,
    fetchSourcePreview
  ])

  useEffect(() => {
    if (!config) return
    
    const source = config.seriesPopularitySource
    // Skip emby_history - nothing to preview
    if (source === 'emby_history') {
      setSeriesLibraryMatch(null)
      return
    }
    
    const timeout = setTimeout(() => {
      fetchSourcePreview(
        'series',
        source,
        config.seriesHybridExternalSource,
        config.mdblistSeriesListId,
        config.mdblistSeriesSort,
        config.seriesLanguages,
        config.seriesIncludeUnknownLanguage
      )
    }, 500)
    return () => clearTimeout(timeout)
  }, [
    config?.seriesPopularitySource,
    config?.seriesHybridExternalSource,
    config?.mdblistSeriesListId,
    config?.mdblistSeriesSort,
    config?.seriesLanguages,
    config?.seriesIncludeUnknownLanguage,
    fetchSourcePreview
  ])

  // Fetch images - override defaults only if custom images exist
  const fetchImages = useCallback(async () => {
    try {
      const libraryTypes = ['top-picks-movies', 'top-picks-series']
      const imagePromises = libraryTypes.map(async (id) => {
        try {
          const response = await fetch(`/api/images/library/${id}?imageType=Primary`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            // Only return custom URL if it exists, otherwise keep default
            if (data.url) {
              return { id, url: data.url, isDefault: false }
            }
          }
          // Fall back to bundled default
          return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
        } catch {
          // Fall back to bundled default on error
          return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
        }
      })

      const results = await Promise.all(imagePromises)
      const imageMap: Record<string, LibraryImageInfo> = {}
      results.forEach((r) => {
        imageMap[r.id] = { url: r.url, isDefault: r.isDefault }
      })
      setImages(imageMap)
    } catch (err) {
      console.error('Failed to load library images', err)
    }
  }, [])

  const handleUpload = useCallback(async (libraryTypeId: string, file: File) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('topPicksAdmin.errors.uploadFailed'))
      }

      const data = await response.json()
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.uploadFailed'))
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [t])

  const handleDeleteImage = useCallback(async (libraryTypeId: string) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('topPicksAdmin.errors.deleteFailed'))
      }

      // Revert to bundled default image
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: DEFAULT_LIBRARY_IMAGES[libraryTypeId], isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.deleteFailed'))
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [t])

  // Check if MDBList is configured
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

  // Fetch preview counts (debounced)
  const fetchPreviewCounts = useCallback(async (cfg: TopPicksConfig) => {
    // Only fetch if using emby_history or hybrid mode (needs local watch history data)
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
        const data = await response.json()
        setPreviewCounts(data)
      }
    } catch {
      // Silently fail preview
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // Debounce preview fetch when settings change
  // We intentionally watch specific properties, not the whole config object
  useEffect(() => {
    if (!config) return
    const timeout = setTimeout(() => {
      fetchPreviewCounts(config)
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config?.moviesMinUniqueViewers,
    config?.moviesTimeWindowDays,
    config?.seriesMinUniqueViewers,
    config?.seriesTimeWindowDays,
    config?.moviesPopularitySource,
    config?.seriesPopularitySource,
    fetchPreviewCounts,
  ])

  // Fetch config on mount
  useEffect(() => {
    fetchConfig()
    fetchImages()
    checkMDBListConfig()
  }, [fetchImages, checkMDBListConfig])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/top-picks')
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.fetchConfig'))
      const data = await response.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
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
  }

  const handleReset = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/top-picks/reset', {
        method: 'POST',
      })
      if (!response.ok) throw new Error(t('topPicksAdmin.errors.resetConfig'))
      const data = await response.json()
      setConfig(data)
      setSuccess(t('topPicksAdmin.success.reset'))
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshNow = async () => {
    try {
      const response = await fetch('/api/jobs/refresh-top-picks/run', {
        method: 'POST',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('topPicksAdmin.errors.startJob'))
      }
      setSuccess(t('topPicksAdmin.success.refreshStarted'))
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.unknown'))
    }
  }

  const updateConfig = (updates: Partial<TopPicksConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  // Helper to get readable source name
  const getSourceName = (source: PopularitySource): string => {
    const option = sourceOptions.find((o) => o.value === source)
    return option?.label || source
  }

  // Open preview modal for a media type
  const openPreviewModal = (mediaType: 'movies' | 'series') => {
    setPreviewModalMediaType(mediaType)
    setPreviewModalOpen(true)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  if (!config) {
    return (
      <Alert severity="error">{t('topPicksAdmin.loadFailed')}</Alert>
    )
  }

  // Calculate proportional percentages for display (weights are normalized at calculation time)
  const totalWeight = config.uniqueViewersWeight + config.playCountWeight + config.completionWeight
  const getProportionalPercent = (weight: number) => 
    totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 33

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Card */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon color="primary" /> {t('topPicksAdmin.title')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
                {t('topPicksAdmin.subtitle')}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.isEnabled}
                  onChange={(e) => updateConfig({ isEnabled: e.target.checked })}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Typography fontWeight={500}>
                  {config.isEnabled ? t('topPicksAdmin.enabled') : t('topPicksAdmin.disabled')}
                </Typography>
              }
              labelPlacement="start"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {config.lastRefreshedAt && (
            <Chip
              label={t('topPicksAdmin.lastRefreshed', {
                datetime: new Date(config.lastRefreshedAt).toLocaleString(),
              })}
              size="small"
              variant="outlined"
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Movies & Series Settings - Side by Side */}
      <Grid container spacing={3}>
        {/* Movies Settings Card */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MovieIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.movies.settingsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('topPicksAdmin.movies.settingsSubtitle')}
              </Typography>

          {/* Data Source */}
          <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
            <InputLabel id="movies-source-label">{t('topPicksAdmin.fields.dataSource')}</InputLabel>
            <Select
              labelId="movies-source-label"
              label={t('topPicksAdmin.fields.dataSource')}
              value={config.moviesPopularitySource}
              onChange={(e) => updateConfig({ moviesPopularitySource: e.target.value as PopularitySource })}
            >
              {sourceOptions.map((opt) => (
                <MenuItem 
                  key={opt.value} 
                  value={opt.value}
                  disabled={opt.requiresMdblist && !mdblistConfigured}
                >
                  <Box>
                    <Typography variant="body2">{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Hybrid External Source Selector */}
          {config.moviesPopularitySource === 'hybrid' && (
            <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
              <InputLabel id="movies-hybrid-source-label">{t('topPicksAdmin.fields.externalSourceBlend')}</InputLabel>
              <Select
                labelId="movies-hybrid-source-label"
                label={t('topPicksAdmin.fields.externalSourceBlend')}
                value={config.moviesHybridExternalSource || 'tmdb_popular'}
                onChange={(e) => updateConfig({ moviesHybridExternalSource: e.target.value as HybridExternalSource })}
              >
                {hybridExternalOptions.map((opt) => (
                  <MenuItem 
                    key={opt.value} 
                    value={opt.value}
                    disabled={opt.requiresMdblist && !mdblistConfigured}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Library Match Preview for TMDB sources */}
          {(config.moviesPopularitySource.startsWith('tmdb_') || 
            (config.moviesPopularitySource === 'hybrid' && config.moviesHybridExternalSource?.startsWith('tmdb_'))) && (
            <Box sx={{ mb: 3 }}>
              <LibraryMatchPreview
                loading={moviesMatchLoading}
                data={moviesLibraryMatch}
                expanded={moviesMatchExpanded}
                onExpandToggle={() => setMoviesMatchExpanded(!moviesMatchExpanded)}
                onOpenPreview={() => openPreviewModal('movies')}
              />
            </Box>
          )}

          {/* MDBList Selector (for mdblist source or hybrid with mdblist) */}
          {((config.moviesPopularitySource === 'mdblist') || 
            (config.moviesPopularitySource === 'hybrid' && config.moviesHybridExternalSource === 'mdblist')) && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={8}>
                  <MDBListSelector
                    value={config.mdblistMoviesListId ? { id: config.mdblistMoviesListId, name: config.mdblistMoviesListName || '' } : null}
                    onChange={(newValue) => {
                      updateConfig({
                        mdblistMoviesListId: newValue?.id || null,
                        mdblistMoviesListName: newValue?.name || null,
                      })
                    }}
                    mediatype="movie"
                    label={t('topPicksAdmin.movies.listLabel')}
                    helperText={t('topPicksAdmin.movies.listHelper')}
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="movies-sort-label">{t('topPicksAdmin.fields.sortBy')}</InputLabel>
                    <Select
                      labelId="movies-sort-label"
                      label={t('topPicksAdmin.fields.sortBy')}
                      value={config.mdblistMoviesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistMoviesSort: e.target.value })}
                    >
                      {sortOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistMoviesListId && (
                <LibraryMatchPreview
                  loading={moviesMatchLoading}
                  data={moviesLibraryMatch}
                  expanded={moviesMatchExpanded}
                  onExpandToggle={() => setMoviesMatchExpanded(!moviesMatchExpanded)}
                  onOpenPreview={() => openPreviewModal('movies')}
                />
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.moviesPopularitySource === 'emby_history' || config.moviesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.timeWindow')}
                  type="number"
                  value={config.moviesTimeWindowDays}
                  onChange={(e) => updateConfig({ moviesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{t('topPicksAdmin.fields.daysSuffix')}</InputAdornment>,
                  }}
                  size="small"
                  helperText={t('topPicksAdmin.fields.timeWindowHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.minViewers')}
                  type="number"
                  value={config.moviesMinUniqueViewers}
                  onChange={(e) => updateConfig({ moviesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText={t('topPicksAdmin.fields.minViewersHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('topPicksAdmin.movies.matchingCriteria')}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.movies ?? t('topPicksAdmin.emDash')
                    )}
                  </Typography>
                  {previewCounts && previewCounts.movies > 30 && config.moviesPopularitySource === 'emby_history' && (
                    <Typography variant="caption" color="warning.main">
                      {t('topPicksAdmin.movies.largeListWarning', {
                        count: previewCounts.recommendedMoviesMinViewers,
                      })}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights */}
          {config.moviesPopularitySource === 'hybrid' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksAdmin.hybrid.blendWeightTitle')}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridExternalWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => t('topPicksAdmin.hybrid.sliderLocal', { percent: v })}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('topPicksAdmin.hybrid.blendSummary', {
                  localPercent: Math.round(config.hybridLocalWeight * 100),
                  externalPercent: Math.round((config.hybridExternalWeight || (1 - config.hybridLocalWeight)) * 100),
                })}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Language Filter */}
          {config.moviesPopularitySource !== 'emby_history' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TranslateIcon fontSize="small" />
                {t('topPicksAdmin.fields.languageFilter')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {t('topPicksAdmin.movies.languageFilterHint')}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled}>
                    <InputLabel id="movies-language-label">{t('topPicksAdmin.fields.languages')}</InputLabel>
                    <Select
                      labelId="movies-language-label"
                      label={t('topPicksAdmin.fields.languages')}
                      multiple
                      value={config.moviesLanguages || []}
                      onChange={(e) => updateConfig({ moviesLanguages: e.target.value as string[] })}
                      input={<OutlinedInput label={t('topPicksAdmin.fields.languages')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={getLanguageName(value)} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {COMMON_LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          <Checkbox checked={(config.moviesLanguages || []).includes(lang)} />
                          <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                        </MenuItem>
                      ))}
                      <Divider />
                      {extendedLanguageCodes.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            <Checkbox checked={(config.moviesLanguages || []).includes(lang)} />
                            <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.moviesIncludeUnknownLanguage ?? true}
                        onChange={(e) => updateConfig({ moviesIncludeUnknownLanguage: e.target.checked })}
                        disabled={!config.isEnabled || (config.moviesLanguages || []).length === 0}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{t('topPicksAdmin.language.includeUnknown')}</Typography>}
                  />
                </Grid>
              </Grid>
              {(config.moviesLanguages || []).length > 0 && (
                <Button
                  size="small"
                  onClick={() => updateConfig({ moviesLanguages: [], moviesIncludeUnknownLanguage: true })}
                  sx={{ mt: 1 }}
                >
                  {t('topPicksAdmin.language.clearFilter')}
                </Button>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            {t('topPicksAdmin.fields.listSize')}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {t('topPicksAdmin.movies.listSizeHint')}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.moviesUseAllMatches}
                    onChange={(e) => updateConfig({ moviesUseAllMatches: e.target.checked })}
                    disabled={!config.isEnabled}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {config.moviesUseAllMatches
                      ? t('topPicksAdmin.listMode.useAllMatches')
                      : t('topPicksAdmin.listMode.limitCount')}
                  </Typography>
                }
              />
            </Grid>
            {!config.moviesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.movies.moviesToShow')}
                  type="number"
                  value={config.moviesCount}
                  onChange={(e) => updateConfig({ moviesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.moviesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>

          {/* Save Button */}
          {hasChanges && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                size="small"
              >
                {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
              </Button>
            </Box>
          )}
            </CardContent>
          </Card>
        </Grid>

        {/* Series Settings Card */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TvIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.series.settingsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('topPicksAdmin.series.settingsSubtitle')}
              </Typography>

          {/* Data Source */}
          <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
            <InputLabel id="series-source-label">{t('topPicksAdmin.fields.dataSource')}</InputLabel>
            <Select
              labelId="series-source-label"
              label={t('topPicksAdmin.fields.dataSource')}
              value={config.seriesPopularitySource}
              onChange={(e) => updateConfig({ seriesPopularitySource: e.target.value as PopularitySource })}
            >
              {sourceOptions.map((opt) => (
                <MenuItem 
                  key={opt.value} 
                  value={opt.value}
                  disabled={opt.requiresMdblist && !mdblistConfigured}
                >
                  <Box>
                    <Typography variant="body2">{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Hybrid External Source Selector */}
          {config.seriesPopularitySource === 'hybrid' && (
            <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
              <InputLabel id="series-hybrid-source-label">{t('topPicksAdmin.fields.externalSourceBlend')}</InputLabel>
              <Select
                labelId="series-hybrid-source-label"
                label={t('topPicksAdmin.fields.externalSourceBlend')}
                value={config.seriesHybridExternalSource || 'tmdb_popular'}
                onChange={(e) => updateConfig({ seriesHybridExternalSource: e.target.value as HybridExternalSource })}
              >
                {hybridExternalOptions.map((opt) => (
                  <MenuItem 
                    key={opt.value} 
                    value={opt.value}
                    disabled={opt.requiresMdblist && !mdblistConfigured}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Library Match Preview for TMDB sources */}
          {(config.seriesPopularitySource.startsWith('tmdb_') || 
            (config.seriesPopularitySource === 'hybrid' && config.seriesHybridExternalSource?.startsWith('tmdb_'))) && (
            <Box sx={{ mb: 3 }}>
              <LibraryMatchPreview
                loading={seriesMatchLoading}
                data={seriesLibraryMatch}
                expanded={seriesMatchExpanded}
                onExpandToggle={() => setSeriesMatchExpanded(!seriesMatchExpanded)}
                onOpenPreview={() => openPreviewModal('series')}
              />
            </Box>
          )}

          {/* MDBList Selector (for mdblist source or hybrid with mdblist) */}
          {((config.seriesPopularitySource === 'mdblist') || 
            (config.seriesPopularitySource === 'hybrid' && config.seriesHybridExternalSource === 'mdblist')) && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={8}>
                  <MDBListSelector
                    value={config.mdblistSeriesListId ? { id: config.mdblistSeriesListId, name: config.mdblistSeriesListName || '' } : null}
                    onChange={(newValue) => {
                      updateConfig({
                        mdblistSeriesListId: newValue?.id || null,
                        mdblistSeriesListName: newValue?.name || null,
                      })
                    }}
                    mediatype="show"
                    label={t('topPicksAdmin.series.listLabel')}
                    helperText={t('topPicksAdmin.series.listHelper')}
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="series-sort-label">{t('topPicksAdmin.fields.sortBy')}</InputLabel>
                    <Select
                      labelId="series-sort-label"
                      label={t('topPicksAdmin.fields.sortBy')}
                      value={config.mdblistSeriesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistSeriesSort: e.target.value })}
                    >
                      {sortOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistSeriesListId && (
                <LibraryMatchPreview
                  loading={seriesMatchLoading}
                  data={seriesLibraryMatch}
                  expanded={seriesMatchExpanded}
                  onExpandToggle={() => setSeriesMatchExpanded(!seriesMatchExpanded)}
                  onOpenPreview={() => openPreviewModal('series')}
                />
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.seriesPopularitySource === 'emby_history' || config.seriesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.timeWindow')}
                  type="number"
                  value={config.seriesTimeWindowDays}
                  onChange={(e) => updateConfig({ seriesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{t('topPicksAdmin.fields.daysSuffix')}</InputAdornment>,
                  }}
                  size="small"
                  helperText={t('topPicksAdmin.fields.timeWindowHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.minViewers')}
                  type="number"
                  value={config.seriesMinUniqueViewers}
                  onChange={(e) => updateConfig({ seriesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText={t('topPicksAdmin.fields.minViewersHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('topPicksAdmin.series.matchingCriteria')}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.series ?? t('topPicksAdmin.emDash')
                    )}
                  </Typography>
                  {previewCounts && previewCounts.series > 30 && config.seriesPopularitySource === 'emby_history' && (
                    <Typography variant="caption" color="warning.main">
                      {t('topPicksAdmin.series.largeListWarning', {
                        count: previewCounts.recommendedSeriesMinViewers,
                      })}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights (shared with movies) */}
          {config.seriesPopularitySource === 'hybrid' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksAdmin.hybrid.blendWeightTitle')}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridExternalWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => t('topPicksAdmin.hybrid.sliderLocal', { percent: v })}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('topPicksAdmin.hybrid.blendSummary', {
                  localPercent: Math.round(config.hybridLocalWeight * 100),
                  externalPercent: Math.round((config.hybridExternalWeight || (1 - config.hybridLocalWeight)) * 100),
                })}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Language Filter */}
          {config.seriesPopularitySource !== 'emby_history' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TranslateIcon fontSize="small" />
                {t('topPicksAdmin.fields.languageFilter')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {t('topPicksAdmin.series.languageFilterHint')}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled}>
                    <InputLabel id="series-language-label">{t('topPicksAdmin.fields.languages')}</InputLabel>
                    <Select
                      labelId="series-language-label"
                      label={t('topPicksAdmin.fields.languages')}
                      multiple
                      value={config.seriesLanguages || []}
                      onChange={(e) => updateConfig({ seriesLanguages: e.target.value as string[] })}
                      input={<OutlinedInput label={t('topPicksAdmin.fields.languages')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={getLanguageName(value)} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {COMMON_LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          <Checkbox checked={(config.seriesLanguages || []).includes(lang)} />
                          <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                        </MenuItem>
                      ))}
                      <Divider />
                      {extendedLanguageCodes.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            <Checkbox checked={(config.seriesLanguages || []).includes(lang)} />
                            <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.seriesIncludeUnknownLanguage ?? true}
                        onChange={(e) => updateConfig({ seriesIncludeUnknownLanguage: e.target.checked })}
                        disabled={!config.isEnabled || (config.seriesLanguages || []).length === 0}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{t('topPicksAdmin.language.includeUnknown')}</Typography>}
                  />
                </Grid>
              </Grid>
              {(config.seriesLanguages || []).length > 0 && (
                <Button
                  size="small"
                  onClick={() => updateConfig({ seriesLanguages: [], seriesIncludeUnknownLanguage: true })}
                  sx={{ mt: 1 }}
                >
                  {t('topPicksAdmin.language.clearFilter')}
                </Button>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            {t('topPicksAdmin.fields.listSize')}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {t('topPicksAdmin.series.listSizeHint')}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.seriesUseAllMatches}
                    onChange={(e) => updateConfig({ seriesUseAllMatches: e.target.checked })}
                    disabled={!config.isEnabled}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {config.seriesUseAllMatches
                      ? t('topPicksAdmin.listMode.useAllMatches')
                      : t('topPicksAdmin.listMode.limitCount')}
                  </Typography>
                }
              />
            </Grid>
            {!config.seriesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.series.seriesToShow')}
                  type="number"
                  value={config.seriesCount}
                  onChange={(e) => updateConfig({ seriesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.seriesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>

          {/* Save Button */}
          {hasChanges && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                size="small"
              >
                {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
              </Button>
            </Box>
          )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Local Popularity Algorithm (shown if either movies or series uses emby_history/hybrid) */}
      {(config.moviesPopularitySource === 'emby_history' || config.moviesPopularitySource === 'hybrid' ||
        config.seriesPopularitySource === 'emby_history' || config.seriesPopularitySource === 'hybrid') && (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.localAlgorithm.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('topPicksAdmin.localAlgorithm.subtitle')}
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ my: 2 }}>
            <Typography variant="body2" component="div">
              <Trans
                i18nKey="topPicksAdmin.localAlgorithm.factors"
                components={{ strong: <strong />, br: <br /> }}
              />
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.uniqueViewers')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.uniqueViewersWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.uniqueViewersWeight * 100)}
                onChange={(_, value) => updateConfig({ uniqueViewersWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <PlayArrowIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.playCount')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.playCountWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.playCountWeight * 100)}
                onChange={(_, value) => updateConfig({ playCountWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.completionRate')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.completionWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.completionWeight * 100)}
                onChange={(_, value) => updateConfig({ completionWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      )}

      {/* Auto-Request via Seerr */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SendIcon fontSize="small" color="primary" />
            {t('topPicksAdmin.autoRequest.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('topPicksAdmin.autoRequest.subtitle')}
          </Typography>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
            <Typography variant="body2" component="div">
              {t('topPicksAdmin.autoRequest.infoLine1')}
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
              <Trans i18nKey="topPicksAdmin.autoRequest.infoLine2" components={{ 1: <strong /> }} />
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            {/* Movies Auto-Request */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MovieIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">{t('topPicksAdmin.autoRequest.moviesSection')}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.moviesAutoRequestEnabled}
                      onChange={(e) => updateConfig({ moviesAutoRequestEnabled: e.target.checked })}
                      disabled={!config.isEnabled || config.moviesPopularitySource === 'emby_history'}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {t('topPicksAdmin.autoRequest.enableMovies')}
                    </Typography>
                  }
                />
                {config.moviesPopularitySource === 'emby_history' && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, ml: 4 }}>
                    {t('topPicksAdmin.autoRequest.requiresExternal')}
                  </Typography>
                )}
                <Collapse in={config.moviesAutoRequestEnabled}>
                  <Box sx={{ mt: 2, ml: 4 }}>
                    <TextField
                      fullWidth
                      label={t('topPicksAdmin.fields.maxRequestsPerRun')}
                      type="number"
                      value={config.moviesAutoRequestLimit}
                      onChange={(e) => updateConfig({ moviesAutoRequestLimit: Math.max(1, parseInt(e.target.value) || 10) })}
                      size="small"
                      disabled={!config.isEnabled}
                      InputProps={{
                        inputProps: { min: 1, max: 100 }
                      }}
                      helperText={t('topPicksAdmin.autoRequest.moviesHelper')}
                    />
                  </Box>
                </Collapse>
              </Card>
            </Grid>

            {/* Series Auto-Request */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TvIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">{t('topPicksAdmin.autoRequest.seriesSection')}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.seriesAutoRequestEnabled}
                      onChange={(e) => updateConfig({ seriesAutoRequestEnabled: e.target.checked })}
                      disabled={!config.isEnabled || config.seriesPopularitySource === 'emby_history'}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {t('topPicksAdmin.autoRequest.enableSeries')}
                    </Typography>
                  }
                />
                {config.seriesPopularitySource === 'emby_history' && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, ml: 4 }}>
                    {t('topPicksAdmin.autoRequest.requiresExternal')}
                  </Typography>
                )}
                <Collapse in={config.seriesAutoRequestEnabled}>
                  <Box sx={{ mt: 2, ml: 4 }}>
                    <TextField
                      fullWidth
                      label={t('topPicksAdmin.fields.maxRequestsPerRun')}
                      type="number"
                      value={config.seriesAutoRequestLimit}
                      onChange={(e) => updateConfig({ seriesAutoRequestLimit: Math.max(1, parseInt(e.target.value) || 10) })}
                      size="small"
                      disabled={!config.isEnabled}
                      InputProps={{
                        inputProps: { min: 1, max: 100 }
                      }}
                      helperText={t('topPicksAdmin.autoRequest.seriesHelper')}
                    />
                  </Box>
                </Collapse>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 4: Output Configuration */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <OutputIcon fontSize="small" color="primary" />
            {t('topPicksAdmin.output.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('topPicksAdmin.output.subtitle')}
          </Typography>

          {/* Output Type Explanations */}
          <Accordion defaultExpanded={false} sx={{ mb: 3, bgcolor: 'action.hover' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoOutlinedIcon fontSize="small" />
                {t('topPicksAdmin.output.accordionTitle')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FolderIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.libraryHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.libraryBody')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CollectionsIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.collectionHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.collectionBody')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlaylistPlayIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.playlistHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.playlistBody')}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Movies & Series Output - Side by Side */}
          <Grid container spacing={3}>
            {/* Movies Output Config */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MovieIcon color="primary" />
                    {t('topPicksAdmin.output.moviesOutput')}
                    {images['top-picks-movies']?.url && (
                      <Chip size="small" label={t('topPicksAdmin.output.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

              {/* Library Cover Image */}
              <Box sx={{ mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ImageIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.output.libraryCoverImage')}</Typography>
                </Box>
                <Box sx={{ maxWidth: 400 }}>
                  <ImageUpload
                    currentImageUrl={images['top-picks-movies']?.url}
                    isDefault={images['top-picks-movies']?.isDefault}
                    recommendedDimensions={RECOMMENDED_DIMENSIONS}
                    onUpload={(file) => handleUpload('top-picks-movies', file)}
                    onDelete={images['top-picks-movies']?.url ? () => handleDeleteImage('top-picks-movies') : undefined}
                    loading={uploadingFor === 'top-picks-movies'}
                    height={160}
                    label={t('topPicksAdmin.output.dropImage169')}
                    showDelete={!!images['top-picks-movies']?.url}
                  />
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksAdmin.fields.outputTypesHeading')}
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesLibraryEnabled}
                          onChange={(e) => updateConfig({ moviesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.librarySidebar')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesCollectionEnabled}
                          onChange={(e) => updateConfig({ moviesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.collectionBoxSet')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesPlaylistEnabled}
                          onChange={(e) => updateConfig({ moviesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.playlist')}</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        {t('topPicksAdmin.fields.names')}
                      </Typography>
                      {config.moviesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.libraryName')}
                          value={config.moviesLibraryName}
                          onChange={(e) => updateConfig({ moviesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.moviesCollectionEnabled || config.moviesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.collectionPlaylistName')}
                          value={config.moviesCollectionName}
                          onChange={(e) => updateConfig({ moviesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.moviesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          {t('topPicksAdmin.fields.libraryFileType')}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.moviesUseSymlinks}
                              onChange={(e) => updateConfig({ moviesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.moviesUseSymlinks
                                ? t('topPicksAdmin.output.symlinks')
                                : t('topPicksAdmin.output.strmFiles')}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                </Grid>
              </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Series Output Config */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TvIcon color="primary" />
                    {t('topPicksAdmin.output.seriesOutput')}
                    {images['top-picks-series']?.url && (
                      <Chip size="small" label={t('topPicksAdmin.output.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

                  {/* Library Cover Image */}
                  <Box sx={{ mb: 3 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ImageIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.output.libraryCoverImage')}</Typography>
                    </Box>
                    <Box sx={{ maxWidth: 400 }}>
                      <ImageUpload
                        currentImageUrl={images['top-picks-series']?.url}
                        isDefault={images['top-picks-series']?.isDefault}
                        recommendedDimensions={RECOMMENDED_DIMENSIONS}
                        onUpload={(file) => handleUpload('top-picks-series', file)}
                        onDelete={images['top-picks-series']?.url ? () => handleDeleteImage('top-picks-series') : undefined}
                        loading={uploadingFor === 'top-picks-series'}
                        height={160}
                        label={t('topPicksAdmin.output.dropImage169')}
                        showDelete={!!images['top-picks-series']?.url}
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksAdmin.fields.outputTypesHeading')}
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesLibraryEnabled}
                          onChange={(e) => updateConfig({ seriesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.librarySidebar')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesCollectionEnabled}
                          onChange={(e) => updateConfig({ seriesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.collectionBoxSet')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesPlaylistEnabled}
                          onChange={(e) => updateConfig({ seriesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.playlist')}</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        {t('topPicksAdmin.fields.names')}
                      </Typography>
                      {config.seriesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.libraryName')}
                          value={config.seriesLibraryName}
                          onChange={(e) => updateConfig({ seriesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.seriesCollectionEnabled || config.seriesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.collectionPlaylistName')}
                          value={config.seriesCollectionName}
                          onChange={(e) => updateConfig({ seriesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.seriesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          {t('topPicksAdmin.fields.libraryFileType')}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.seriesUseSymlinks}
                              onChange={(e) => updateConfig({ seriesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.seriesUseSymlinks
                                ? t('topPicksAdmin.output.symlinks')
                                : t('topPicksAdmin.output.strmFiles')}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                  </Grid>
                </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Symlink Warning */}
          {(config.moviesUseSymlinks || config.seriesUseSymlinks) && (
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              <Typography variant="body2" component="div">
                <Trans i18nKey="topPicksAdmin.output.symlinkWarning" components={{ strong: <strong /> }} />
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={handleReset}
                disabled={saving}
              >
                {t('topPicksAdmin.actions.resetDefaults')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshNow}
                disabled={!config.isEnabled}
              >
                {t('topPicksAdmin.actions.refreshNow')}
              </Button>
            </Stack>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="large"
            >
              {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <TopPicksPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        mediaType={previewModalMediaType}
        source={previewModalMediaType === 'movies' ? config.moviesPopularitySource : config.seriesPopularitySource}
        hybridExternalSource={previewModalMediaType === 'movies' ? config.moviesHybridExternalSource : config.seriesHybridExternalSource}
        mdblistListId={previewModalMediaType === 'movies' ? config.mdblistMoviesListId ?? undefined : config.mdblistSeriesListId ?? undefined}
        mdblistSort={previewModalMediaType === 'movies' ? config.mdblistMoviesSort : config.mdblistSeriesSort}
        sourceName={getSourceName(previewModalMediaType === 'movies' ? config.moviesPopularitySource : config.seriesPopularitySource)}
        savedLanguages={previewModalMediaType === 'movies' ? config.moviesLanguages : config.seriesLanguages}
        savedIncludeUnknownLanguage={previewModalMediaType === 'movies' ? config.moviesIncludeUnknownLanguage : config.seriesIncludeUnknownLanguage}
      />
    </Box>
  )
}
