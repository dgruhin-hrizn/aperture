import React, { useState, useEffect, useCallback } from 'react'
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
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Collapse,
  List,
  ListItem,
  ListItemText,
  InputLabel,
} from '@mui/material'
import { MDBListSelector } from './MDBListSelector'
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
import { ImageUpload } from '../../../components/ImageUpload'
import { DEFAULT_LIBRARY_IMAGES } from '../../setup/constants'

type PopularitySource = 'local' | 'mdblist' | 'hybrid'

interface TopPicksConfig {
  isEnabled: boolean
  // Movies-specific settings
  moviesPopularitySource: PopularitySource
  moviesTimeWindowDays: number
  moviesMinUniqueViewers: number
  moviesUseAllMatches: boolean
  moviesCount: number
  // Series-specific settings
  seriesPopularitySource: PopularitySource
  seriesTimeWindowDays: number
  seriesMinUniqueViewers: number
  seriesUseAllMatches: boolean
  seriesCount: number
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
  hybridMdblistWeight: number
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

const SORT_OPTIONS: SortOption[] = [
  { value: 'score', label: 'MDBList Score' },
  { value: 'score_average', label: 'Average Score' },
  { value: 'imdbrating', label: 'IMDb Rating' },
  { value: 'imdbvotes', label: 'IMDb Votes' },
  { value: 'imdbpopular', label: 'IMDb Popularity' },
  { value: 'tmdbpopular', label: 'TMDb Popularity' },
  { value: 'rtomatoes', label: 'Rotten Tomatoes' },
  { value: 'metacritic', label: 'Metacritic' },
]

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

  // Fetch library match when list selection or sort changes
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

  // Fetch library match when list ID or sort changes (debounced)
  useEffect(() => {
    if (!config?.mdblistMoviesListId) {
      setMoviesLibraryMatch(null)
      return
    }
    const timeout = setTimeout(() => {
      fetchLibraryMatch(config.mdblistMoviesListId, 'movies', config.mdblistMoviesSort || 'score')
    }, 500)
    return () => clearTimeout(timeout)
  }, [config?.mdblistMoviesListId, config?.mdblistMoviesSort, fetchLibraryMatch])

  useEffect(() => {
    if (!config?.mdblistSeriesListId) {
      setSeriesLibraryMatch(null)
      return
    }
    const timeout = setTimeout(() => {
      fetchLibraryMatch(config.mdblistSeriesListId, 'series', config.mdblistSeriesSort || 'score')
    }, 500)
    return () => clearTimeout(timeout)
  }, [config?.mdblistSeriesListId, config?.mdblistSeriesSort, fetchLibraryMatch])

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
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

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
        throw new Error(data.error || 'Delete failed')
      }

      // Revert to bundled default image
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: DEFAULT_LIBRARY_IMAGES[libraryTypeId], isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

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
    // Only fetch if using local or hybrid mode
    if (cfg.moviesPopularitySource === 'mdblist' && cfg.seriesPopularitySource === 'mdblist') {
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
      if (!response.ok) throw new Error('Failed to fetch config')
      const data = await response.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
      if (!response.ok) throw new Error('Failed to save config')
      setSuccess('Top Picks configuration saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
      if (!response.ok) throw new Error('Failed to reset config')
      const data = await response.json()
      setConfig(data)
      setSuccess('Configuration reset to defaults!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
        throw new Error(data.error || 'Failed to start job')
      }
      setSuccess('Top Picks refresh job started!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const updateConfig = (updates: Partial<TopPicksConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
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
      <Alert severity="error">Failed to load Top Picks configuration</Alert>
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
                <TrendingUpIcon color="primary" /> Top Picks
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
                Create global "what's popular" libraries based on aggregated watch history from all users.
                Unlike personalized recommendations, Top Picks show the same content to everyone.
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
              label={<Typography fontWeight={500}>{config.isEnabled ? 'Enabled' : 'Disabled'}</Typography>}
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
              label={`Last refreshed: ${new Date(config.lastRefreshedAt).toLocaleString()}`}
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
                Movies Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure data source, filters, and list size for movie Top Picks.
              </Typography>

          {/* Data Source */}
          <FormControl component="fieldset" disabled={!config.isEnabled} sx={{ mb: 3, width: '100%' }}>
            <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Data Source</FormLabel>
            <RadioGroup
              row
              value={config.moviesPopularitySource}
              onChange={(e) => updateConfig({ moviesPopularitySource: e.target.value as PopularitySource })}
            >
              <FormControlLabel
                value="local"
                control={<Radio size="small" />}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <HomeIcon fontSize="small" />
                    <Typography variant="body2">Local Watch History</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="mdblist"
                control={<Radio size="small" />}
                disabled={!mdblistConfigured}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PublicIcon fontSize="small" color={mdblistConfigured ? 'inherit' : 'disabled'} />
                    <Typography variant="body2" color={mdblistConfigured ? 'inherit' : 'text.disabled'}>MDBList</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="hybrid"
                control={<Radio size="small" />}
                disabled={!mdblistConfigured}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <MergeIcon fontSize="small" color={mdblistConfigured ? 'inherit' : 'disabled'} />
                    <Typography variant="body2" color={mdblistConfigured ? 'inherit' : 'text.disabled'}>Hybrid</Typography>
                  </Box>
                }
              />
            </RadioGroup>
            {!mdblistConfigured && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Configure MDBList in Settings → Integrations to enable MDBList and Hybrid options.
              </Typography>
            )}
          </FormControl>

          {/* MDBList Selector (for mdblist or hybrid) */}
          {(config.moviesPopularitySource === 'mdblist' || config.moviesPopularitySource === 'hybrid') && mdblistConfigured && (
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
                    label="Movies List"
                    helperText="Select a MDBList to use for movie rankings"
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="movies-sort-label">Sort By</InputLabel>
                    <Select
                      labelId="movies-sort-label"
                      label="Sort By"
                      value={config.mdblistMoviesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistMoviesSort: e.target.value })}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistMoviesListId && (
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  {moviesMatchLoading ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">Checking library matches...</Typography>
                    </Box>
                  ) : moviesLibraryMatch ? (
                    <>
                      <Typography variant="body2">
                        List contains <strong>{moviesLibraryMatch.total}</strong> items
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        Your library has <strong>{moviesLibraryMatch.matched}</strong> matches
                      </Typography>
                      {moviesLibraryMatch.missing.length > 0 && (
                        <>
                          <Box 
                            onClick={() => setMoviesMatchExpanded(!moviesMatchExpanded)}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5, 
                              cursor: 'pointer',
                              color: 'warning.main',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                          >
                            <ExpandMoreIcon 
                              fontSize="small" 
                              sx={{ 
                                transform: moviesMatchExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.2s'
                              }} 
                            />
                            <Typography variant="body2">
                              Missing from your library ({moviesLibraryMatch.missing.length})
                            </Typography>
                          </Box>
                          <Collapse in={moviesMatchExpanded}>
                            <List dense sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                              {moviesLibraryMatch.missing.map((item, idx) => (
                                <ListItem key={idx} sx={{ py: 0 }}>
                                  <ListItemText 
                                    primary={`${item.title}${item.year ? ` (${item.year})` : ''}`}
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Collapse>
                        </>
                      )}
                    </>
                  ) : moviesListCounts ? (
                    <Typography variant="caption" color="text.secondary">
                      List contains {moviesListCounts.total} items
                    </Typography>
                  ) : null}
                </Box>
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.moviesPopularitySource === 'local' || config.moviesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Time Window"
                  type="number"
                  value={config.moviesTimeWindowDays}
                  onChange={(e) => updateConfig({ moviesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">days</InputAdornment>,
                  }}
                  size="small"
                  helperText="How far back to look at watch history"
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Minimum Viewers"
                  type="number"
                  value={config.moviesMinUniqueViewers}
                  onChange={(e) => updateConfig({ moviesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText="Required unique viewers to qualify"
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Movies matching criteria
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.movies ?? '—'
                    )}
                  </Typography>
                  {previewCounts && previewCounts.movies > 30 && config.moviesPopularitySource === 'local' && (
                    <Typography variant="caption" color="warning.main">
                      Large list — consider MDBList or increase minimum viewers to {previewCounts.recommendedMoviesMinViewers}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights */}
          {config.moviesPopularitySource === 'hybrid' && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Blend Weight (Local vs MDBList)
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridMdblistWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `Local ${v}%`}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            List Size
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Limit to a specific number of top movies, or include all matches from your criteria.
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
                    {config.moviesUseAllMatches ? 'Use all matches' : 'Limit count'}
                  </Typography>
                }
              />
            </Grid>
            {!config.moviesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label="Movies to Show"
                  type="number"
                  value={config.moviesCount}
                  onChange={(e) => updateConfig({ moviesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.moviesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Series Settings Card */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TvIcon fontSize="small" color="primary" />
                Series Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure data source, filters, and list size for series Top Picks.
              </Typography>

          {/* Data Source */}
          <FormControl component="fieldset" disabled={!config.isEnabled} sx={{ mb: 3, width: '100%' }}>
            <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Data Source</FormLabel>
            <RadioGroup
              row
              value={config.seriesPopularitySource}
              onChange={(e) => updateConfig({ seriesPopularitySource: e.target.value as PopularitySource })}
            >
              <FormControlLabel
                value="local"
                control={<Radio size="small" />}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <HomeIcon fontSize="small" />
                    <Typography variant="body2">Local Watch History</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="mdblist"
                control={<Radio size="small" />}
                disabled={!mdblistConfigured}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PublicIcon fontSize="small" color={mdblistConfigured ? 'inherit' : 'disabled'} />
                    <Typography variant="body2" color={mdblistConfigured ? 'inherit' : 'text.disabled'}>MDBList</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="hybrid"
                control={<Radio size="small" />}
                disabled={!mdblistConfigured}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <MergeIcon fontSize="small" color={mdblistConfigured ? 'inherit' : 'disabled'} />
                    <Typography variant="body2" color={mdblistConfigured ? 'inherit' : 'text.disabled'}>Hybrid</Typography>
                  </Box>
                }
              />
            </RadioGroup>
            {!mdblistConfigured && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Configure MDBList in Settings → Integrations to enable MDBList and Hybrid options.
              </Typography>
            )}
          </FormControl>

          {/* MDBList Selector (for mdblist or hybrid) */}
          {(config.seriesPopularitySource === 'mdblist' || config.seriesPopularitySource === 'hybrid') && mdblistConfigured && (
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
                    label="Series List"
                    helperText="Select a MDBList to use for series rankings"
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="series-sort-label">Sort By</InputLabel>
                    <Select
                      labelId="series-sort-label"
                      label="Sort By"
                      value={config.mdblistSeriesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistSeriesSort: e.target.value })}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistSeriesListId && (
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  {seriesMatchLoading ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">Checking library matches...</Typography>
                    </Box>
                  ) : seriesLibraryMatch ? (
                    <>
                      <Typography variant="body2">
                        List contains <strong>{seriesLibraryMatch.total}</strong> items
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        Your library has <strong>{seriesLibraryMatch.matched}</strong> matches
                      </Typography>
                      {seriesLibraryMatch.missing.length > 0 && (
                        <>
                          <Box 
                            onClick={() => setSeriesMatchExpanded(!seriesMatchExpanded)}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5, 
                              cursor: 'pointer',
                              color: 'warning.main',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                          >
                            <ExpandMoreIcon 
                              fontSize="small" 
                              sx={{ 
                                transform: seriesMatchExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.2s'
                              }} 
                            />
                            <Typography variant="body2">
                              Missing from your library ({seriesLibraryMatch.missing.length})
                            </Typography>
                          </Box>
                          <Collapse in={seriesMatchExpanded}>
                            <List dense sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                              {seriesLibraryMatch.missing.map((item, idx) => (
                                <ListItem key={idx} sx={{ py: 0 }}>
                                  <ListItemText 
                                    primary={`${item.title}${item.year ? ` (${item.year})` : ''}`}
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Collapse>
                        </>
                      )}
                    </>
                  ) : seriesListCounts ? (
                    <Typography variant="caption" color="text.secondary">
                      List contains {seriesListCounts.total} items
                    </Typography>
                  ) : null}
                </Box>
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.seriesPopularitySource === 'local' || config.seriesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Time Window"
                  type="number"
                  value={config.seriesTimeWindowDays}
                  onChange={(e) => updateConfig({ seriesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">days</InputAdornment>,
                  }}
                  size="small"
                  helperText="How far back to look at watch history"
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Minimum Viewers"
                  type="number"
                  value={config.seriesMinUniqueViewers}
                  onChange={(e) => updateConfig({ seriesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText="Required unique viewers to qualify"
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Series matching criteria
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.series ?? '—'
                    )}
                  </Typography>
                  {previewCounts && previewCounts.series > 30 && config.seriesPopularitySource === 'local' && (
                    <Typography variant="caption" color="warning.main">
                      Large list — consider MDBList or increase minimum viewers to {previewCounts.recommendedSeriesMinViewers}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights (shared with movies for now, but could be separate) */}
          {config.seriesPopularitySource === 'hybrid' && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Blend Weight (Local vs MDBList)
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridMdblistWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `Local ${v}%`}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            List Size
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Limit to a specific number of top series, or include all matches from your criteria.
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
                    {config.seriesUseAllMatches ? 'Use all matches' : 'Limit count'}
                  </Typography>
                }
              />
            </Grid>
            {!config.seriesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label="Series to Show"
                  type="number"
                  value={config.seriesCount}
                  onChange={(e) => updateConfig({ seriesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.seriesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Local Popularity Algorithm (shown if either movies or series uses local/hybrid) */}
      {(config.moviesPopularitySource === 'local' || config.moviesPopularitySource === 'hybrid' ||
        config.seriesPopularitySource === 'local' || config.seriesPopularitySource === 'hybrid') && (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="primary" />
                Local Popularity Algorithm
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Adjust the relative importance of each factor when using Local or Hybrid mode.
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ my: 2 }}>
            <Typography variant="body2">
              <strong>Unique Viewers</strong> = How many different people watched it (popularity breadth)<br />
              <strong>Play Count</strong> = Total number of plays across all users (engagement depth)<br />
              <strong>Completion Rate</strong> = How often people finish watching (quality signal)
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>Unique Viewers</Typography>
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
                <Typography variant="body2" fontWeight={500}>Play Count</Typography>
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
                <Typography variant="body2" fontWeight={500}>Completion Rate</Typography>
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

      {/* Section 4: Output Configuration */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <OutputIcon fontSize="small" color="primary" />
            Output Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose how Top Picks appear in your media server. You can enable multiple output types simultaneously.
          </Typography>

          {/* Output Type Explanations */}
          <Accordion defaultExpanded={false} sx={{ mb: 3, bgcolor: 'action.hover' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoOutlinedIcon fontSize="small" />
                What's the difference between Library, Collection, and Playlist?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FolderIcon fontSize="small" color="primary" /> Library
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Appears as a separate library in your media server sidebar. Contains virtual copies (STRM files) of the media.
                      Best for dedicated browsing of Top Picks.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CollectionsIcon fontSize="small" color="primary" /> Collection (Box Set)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Groups your existing library items into a "box set" that appears when browsing.
                      Uses your original media files directly. Best for organization within existing libraries.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlaylistPlayIcon fontSize="small" color="primary" /> Playlist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Creates an ordered playlist in the Playlists section.
                      Uses your original media files directly. Best for sequential watching or shuffle play.
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
                    Movies Output
                    {images['top-picks-movies']?.url && (
                      <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

              {/* Library Cover Image */}
              <Box sx={{ mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ImageIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={500}>Library Cover Image</Typography>
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
                    label="Drop image (16:9)"
                    showDelete={!!images['top-picks-movies']?.url}
                  />
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Output Types (select one or more)
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
                          <Typography variant="body2">Library (sidebar)</Typography>
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
                          <Typography variant="body2">Collection (Box Set)</Typography>
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
                          <Typography variant="body2">Playlist</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        Names
                      </Typography>
                      {config.moviesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label="Library Name"
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
                          label="Collection/Playlist Name"
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
                          Library File Type
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
                              {config.moviesUseSymlinks ? 'Symlinks' : 'STRM Files'}
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
                    Series Output
                    {images['top-picks-series']?.url && (
                      <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

                  {/* Library Cover Image */}
                  <Box sx={{ mb: 3 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ImageIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={500}>Library Cover Image</Typography>
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
                        label="Drop image (16:9)"
                        showDelete={!!images['top-picks-series']?.url}
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Output Types (select one or more)
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
                          <Typography variant="body2">Library (sidebar)</Typography>
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
                          <Typography variant="body2">Collection (Box Set)</Typography>
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
                          <Typography variant="body2">Playlist</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        Names
                      </Typography>
                      {config.seriesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label="Library Name"
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
                          label="Collection/Playlist Name"
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
                          Library File Type
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
                              {config.seriesUseSymlinks ? 'Symlinks' : 'STRM Files'}
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
              <Typography variant="body2">
                <strong>Symlinks</strong> require that Aperture can access your media files at the exact same paths that your media server uses.
                If paths differ between systems (e.g., Docker containers), use STRM files instead.
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
                Reset to Defaults
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshNow}
                disabled={!config.isEnabled}
              >
                Refresh Now
              </Button>
            </Stack>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="large"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
