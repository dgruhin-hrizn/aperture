import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  Button,
  Alert,
  CircularProgress,
  Slider,
  Chip,
  Switch,
  FormControlLabel,
  Paper,
  Stack,
  Grid,
  Autocomplete,
  TextField,
  Fade,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy'
import StarIcon from '@mui/icons-material/Star'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import Markdown from 'react-markdown'
import { useAuth } from '@/hooks/useAuth'

// Types
interface TasteProfile {
  id: string
  mediaType: 'movie' | 'series'
  hasEmbedding: boolean
  embeddingModel: string | null
  autoUpdatedAt: string | null
  isLocked: boolean
  refreshIntervalDays: number
  minFranchiseItems: number
  minFranchiseSize: number
}

interface FranchisePreference {
  id: string
  franchiseName: string
  preferenceScore: number
  itemsWatched: number
}

interface GenreWeight {
  id: string
  genre: string
  weight: number
}

interface CustomInterest {
  id: string
  interestText: string
}

interface TasteProfileData {
  profile: TasteProfile | null
  franchises: FranchisePreference[]
  genres: GenreWeight[]
  customInterests: CustomInterest[]
  refreshIntervalOptions: number[]
  minFranchiseItemsOptions: number[]
  minFranchiseSizeOptions: number[]
}

interface ProfileStats {
  totalWatched: number
  totalSeriesStarted?: number
  totalEpisodesWatched?: number
  topGenres: string[]
  avgRating: number
  favoriteDecade: string | null
  favoriteNetworks?: string[]
}

interface ProfileOutput {
  synopsis: string
  stats: ProfileStats
}

interface AccessibleLibrary {
  id: string
  name: string
  collectionType: string | null
  isExcluded: boolean
}

const REFRESH_INTERVAL_LABELS: Record<number, string> = {
  7: '7 days',
  14: '2 weeks',
  30: '1 month',
  60: '2 months',
  90: '3 months',
  180: '6 months',
  365: '1 year',
}

interface WatcherIdentitySectionProps {
  mediaType: 'movie' | 'series'
}

export function WatcherIdentitySection({ mediaType }: WatcherIdentitySectionProps) {
  const { user } = useAuth()
  
  // Data states
  const [data, setData] = useState<TasteProfileData | null>(null)
  const [profileOutput, setProfileOutput] = useState<ProfileOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Action states
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [, setSavingSettings] = useState(false)
  const [savingSlider, setSavingSlider] = useState<string | null>(null)
  
  // Editable states
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [minFranchiseItems, setMinFranchiseItems] = useState(1)
  const [minFranchiseSize, setMinFranchiseSize] = useState(2)
  const [isLocked, setIsLocked] = useState(false)
  const [interests, setInterests] = useState<string[]>([])
  const [interestInput, setInterestInput] = useState('')
  
  // Streaming state
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  // Modal state
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  
  // New items tracking (for highlighting)
  const [newItems, setNewItems] = useState<{ franchises: string[]; genres: string[] }>({
    franchises: [],
    genres: [],
  })
  
  // Refs for scrolling to new items
  const franchiseRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const genreRefs = useRef<Record<string, HTMLDivElement | null>>({})
  
  // Library exclusions state
  const [accessibleLibraries, setAccessibleLibraries] = useState<AccessibleLibrary[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(false)
  const [savingLibrary, setSavingLibrary] = useState<string | null>(null)
  
  // Debounce refs
  const sliderDebounceRef = useRef<Record<string, NodeJS.Timeout>>({})

  const isMovie = mediaType === 'movie'
  const accentColor = isMovie ? '#6366f1' : '#ec4899'

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prefsResponse, profileResponse] = await Promise.all([
        fetch(`/api/settings/taste-profile?mediaType=${mediaType}`, { credentials: 'include' }),
        fetch(`/api/users/${user?.id}/${mediaType === 'movie' ? 'taste-profile' : 'series-taste-profile'}`, { credentials: 'include' }),
      ])
      
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json()
        setData(prefsData)
        setRefreshInterval(prefsData.profile?.refreshIntervalDays || 30)
        setMinFranchiseItems(prefsData.profile?.minFranchiseItems || 1)
        setMinFranchiseSize(prefsData.profile?.minFranchiseSize || 2)
        setIsLocked(prefsData.profile?.isLocked || false)
        setInterests(prefsData.customInterests?.map((i: CustomInterest) => i.interestText) || [])
      }
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        setProfileOutput(profileData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [mediaType, user?.id])
  
  // Fetch accessible libraries (only once per component)
  const fetchLibraries = useCallback(async () => {
    if (!user?.id) return
    setLoadingLibraries(true)
    try {
      const response = await fetch(`/api/users/${user.id}/accessible-libraries`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAccessibleLibraries(data.libraries || [])
      }
    } catch (err) {
      console.error('Failed to fetch accessible libraries:', err)
    } finally {
      setLoadingLibraries(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [fetchData, user?.id])
  
  // Fetch libraries only once on mount (shared across movie/series)
  useEffect(() => {
    if (user?.id) {
      fetchLibraries()
    }
  }, [fetchLibraries, user?.id])

  // Check if user has existing preferences
  const hasExistingPreferences = (data?.franchises?.length || 0) > 0 || (data?.genres?.length || 0) > 0

  // Handle click on Analyze button
  const handleAnalyzeClick = () => {
    if (hasExistingPreferences) {
      setShowAnalyzeModal(true)
    } else {
      // No existing preferences, just run reset mode
      performAnalysis('reset')
    }
  }

  // Perform the actual analysis
  const performAnalysis = async (mode: 'reset' | 'merge') => {
    setShowAnalyzeModal(false)
    setAnalyzing(true)
    setError(null)
    setSuccess(null)
    setNewItems({ franchises: [], genres: [] })
    
    try {
      const response = await fetch('/api/settings/taste-profile/rebuild', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType, mode }),
      })
      if (!response.ok) throw new Error('Failed to analyze watch history')
      const result = await response.json()
      
      // Track new items for highlighting
      if (result.newFranchises?.length > 0 || result.newGenres?.length > 0) {
        setNewItems({
          franchises: result.newFranchises || [],
          genres: result.newGenres || [],
        })
      }
      
      // Update lists directly from response (no full page re-render)
      if (result.franchises || result.genres) {
        setData(prev => prev ? {
          ...prev,
          franchises: result.franchises || prev.franchises,
          genres: result.genres || prev.genres,
        } : null)
      }
      
      if (mode === 'merge') {
        const newCount = (result.newFranchises?.length || 0) + (result.newGenres?.length || 0)
        setSuccess(newCount > 0 
          ? `Found ${result.newFranchises?.length || 0} new franchises and ${result.newGenres?.length || 0} new genres!`
          : 'No new items found. Your preferences are up to date!'
        )
      } else {
        setSuccess(`Analysis complete! Found ${result.franchisesUpdated} franchises and ${result.genresUpdated || 0} genres.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze')
    } finally {
      setAnalyzing(false)
    }
  }

  // Save settings (lock/interval)
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await fetch('/api/settings/taste-profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType, isLocked, refreshIntervalDays: refreshInterval, minFranchiseItems, minFranchiseSize }),
      })
    } catch {
      // Silent fail
    } finally {
      setSavingSettings(false)
    }
  }

  // Auto-save slider with debounce
  const handleSliderChange = (type: 'franchise' | 'genre', id: string, name: string, value: number) => {
    // Clear existing debounce
    const key = `${type}-${id}`
    if (sliderDebounceRef.current[key]) {
      clearTimeout(sliderDebounceRef.current[key])
    }
    
    // Remove from new items when user interacts
    if (type === 'franchise' && newItems.franchises.includes(name)) {
      setNewItems(prev => ({
        ...prev,
        franchises: prev.franchises.filter(f => f !== name),
      }))
    } else if (type === 'genre' && newItems.genres.includes(name)) {
      setNewItems(prev => ({
        ...prev,
        genres: prev.genres.filter(g => g !== name),
      }))
    }
    
    // Update local state immediately
    if (type === 'franchise') {
      setData(prev => prev ? {
        ...prev,
        franchises: prev.franchises.map(f => f.id === id ? { ...f, preferenceScore: value } : f)
      } : null)
    } else {
      setData(prev => prev ? {
        ...prev,
        genres: prev.genres.map(g => g.id === id ? { ...g, weight: value } : g)
      } : null)
    }
    
    // Debounce API call
    sliderDebounceRef.current[key] = setTimeout(async () => {
      setSavingSlider(key)
      try {
        if (type === 'franchise') {
          await fetch('/api/settings/taste-profile/franchises', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ franchises: [{ franchiseName: name, mediaType, preferenceScore: value }] }),
          })
        } else {
          await fetch('/api/settings/taste-profile/genres', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genres: [{ genre: name, weight: value }] }),
          })
        }
      } catch {
        // Silent fail
      } finally {
        setSavingSlider(null)
      }
    }, 500)
  }

  // Scroll to a new item
  const scrollToItem = (type: 'franchise' | 'genre', name: string) => {
    const refs = type === 'franchise' ? franchiseRefs : genreRefs
    const element = refs.current[name]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Delete franchise
  const handleDeleteFranchise = async (franchiseName: string) => {
    // Optimistically remove from local state
    setData(prev => prev ? {
      ...prev,
      franchises: prev.franchises.filter(f => f.franchiseName !== franchiseName)
    } : null)
    
    // Also remove from new items if present
    setNewItems(prev => ({
      ...prev,
      franchises: prev.franchises.filter(f => f !== franchiseName),
    }))
    
    try {
      await fetch(`/api/settings/taste-profile/franchises/${encodeURIComponent(franchiseName)}?mediaType=${mediaType}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch {
      // Revert on error - refetch data
      fetchData()
    }
  }

  // Delete genre
  const handleDeleteGenre = async (genre: string) => {
    // Optimistically remove from local state
    setData(prev => prev ? {
      ...prev,
      genres: prev.genres.filter(g => g.genre !== genre)
    } : null)
    
    // Also remove from new items if present
    setNewItems(prev => ({
      ...prev,
      genres: prev.genres.filter(g => g !== genre),
    }))
    
    try {
      await fetch(`/api/settings/taste-profile/genres/${encodeURIComponent(genre)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch {
      // Revert on error - refetch data
      fetchData()
    }
  }

  // Handle interests
  const handleAddInterest = async (interest: string) => {
    if (!interest.trim() || interests.includes(interest.trim())) return
    
    const newInterest = interest.trim()
    setInterests(prev => [...prev, newInterest])
    setInterestInput('')
    
    try {
      await fetch('/api/settings/taste-profile/interests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestText: newInterest }),
      })
      await fetchData()
    } catch {
      // Revert on error
      setInterests(prev => prev.filter(i => i !== newInterest))
    }
  }

  const handleRemoveInterest = async (interest: string) => {
    const interestObj = data?.customInterests?.find(i => i.interestText === interest)
    if (!interestObj) return
    
    setInterests(prev => prev.filter(i => i !== interest))
    
    try {
      await fetch(`/api/settings/taste-profile/interests/${interestObj.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch {
      // Revert on error
      setInterests(prev => [...prev, interest])
    }
  }

  // Handle library exclusion toggle
  const handleToggleLibrary = async (libraryId: string, currentlyExcluded: boolean) => {
    if (!user?.id) return
    
    setSavingLibrary(libraryId)
    
    // Optimistically update UI
    setAccessibleLibraries(prev => 
      prev.map(lib => 
        lib.id === libraryId ? { ...lib, isExcluded: !currentlyExcluded } : lib
      )
    )
    
    try {
      await fetch(`/api/users/${user.id}/excluded-libraries/${libraryId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: !currentlyExcluded }),
      })
    } catch {
      // Revert on error
      setAccessibleLibraries(prev =>
        prev.map(lib =>
          lib.id === libraryId ? { ...lib, isExcluded: currentlyExcluded } : lib
        )
      )
    } finally {
      setSavingLibrary(null)
    }
  }

  // Generate Identity with streaming
  const handleGenerateIdentity = async () => {
    setGenerating(true)
    setIsStreaming(true)
    setStreamingText('')
    setError(null)
    
    try {
      const endpoint = mediaType === 'movie' 
        ? `/api/users/${user?.id}/taste-profile/regenerate`
        : `/api/users/${user?.id}/series-taste-profile/regenerate`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      })
      
      if (!response.ok) throw new Error('Failed to generate identity')
      
      // Check if streaming response (SSE)
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (reader) {
          let fullText = ''
          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            
            // Parse SSE events (data: {...}\n\n format)
            const events = buffer.split('\n\n')
            buffer = events.pop() || '' // Keep incomplete event in buffer
            
            for (const event of events) {
              if (!event.trim()) continue
              
              // Extract data from "data: {...}" format
              const dataMatch = event.match(/^data:\s*(.+)$/m)
              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1])
                  if (data.type === 'text') {
                    fullText += data.content
                    setStreamingText(fullText)
                  } else if (data.type === 'done' && data.stats) {
                    // Update profile output with final stats
                    setProfileOutput({
                      synopsis: fullText,
                      stats: data.stats,
                    })
                  } else if (data.type === 'error') {
                    throw new Error(data.message || 'Stream error')
                  }
                } catch (parseErr) {
                  // Ignore parse errors, might be malformed chunk
                  console.warn('Failed to parse SSE event:', parseErr)
                }
              }
            }
          }
        }
      } else {
        // Non-streaming response (fallback)
        const result = await response.json()
        setProfileOutput(result)
        setStreamingText(result.synopsis || '')
      }
      
      setSuccess('Identity generated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate identity')
    } finally {
      setGenerating(false)
      setIsStreaming(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  const displaySynopsis = isStreaming ? streamingText : (profileOutput?.synopsis || '')
  const stats = profileOutput?.stats

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Analyze Mode Selection Modal */}
      <Dialog 
        open={showAnalyzeModal} 
        onClose={() => setShowAnalyzeModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            Analyze Watch History
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3}>
            You have existing preferences. How would you like to proceed?
          </Typography>
          
          <Stack spacing={2}>
            {/* Reset All Option */}
            <Paper
              onClick={() => performAnalysis('reset')}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'error.main',
                  bgcolor: 'error.main',
                  '& .MuiTypography-root': { color: 'white' },
                  '& .MuiSvgIcon-root': { color: 'white' },
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <RefreshIcon color="error" sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Reset All
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clear all preferences and recalculate from your current watch history
                  </Typography>
                </Box>
              </Box>
            </Paper>
            
            {/* Add New Only Option */}
            <Paper
              onClick={() => performAnalysis('merge')}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'success.main',
                  bgcolor: 'success.main',
                  '& .MuiTypography-root': { color: 'white' },
                  '& .MuiSvgIcon-root': { color: 'white' },
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <AddIcon color="success" sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Add New Only
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Keep your customized preferences and only add newly detected items
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalyzeModal(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Section 1: Identity Settings */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Typography variant="h6" fontWeight={600}>
            Identity Settings
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              size="small"
              label={data?.profile?.hasEmbedding ? 'Active' : 'Not Analyzed'}
              color={data?.profile?.hasEmbedding ? 'success' : 'warning'}
            />
            {data?.profile?.isLocked && (
              <Chip size="small" icon={<LockIcon />} label="Locked" color="info" />
            )}
            {data?.profile?.autoUpdatedAt && (
              <Typography variant="caption" color="text.secondary">
                Analyzed {formatDate(data.profile.autoUpdatedAt)}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          {/* Auto-refresh Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Box
              sx={{
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                height: '100%',
              }}
            >
              <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                {isLocked ? <LockIcon fontSize="small" color="action" /> : <LockOpenIcon fontSize="small" color="action" />}
                <Typography variant="body2" fontWeight={600}>Auto-refresh</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <Switch
                  checked={!isLocked}
                  onChange={(e) => {
                    setIsLocked(!e.target.checked)
                    setTimeout(handleSaveSettings, 100)
                  }}
                  size="small"
                />
                {!isLocked && (
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select
                      value={refreshInterval}
                      onChange={(e) => {
                        setRefreshInterval(e.target.value as number)
                        setTimeout(handleSaveSettings, 100)
                      }}
                    >
                      {Object.entries(REFRESH_INTERVAL_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={Number(value)}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {isLocked 
                  ? 'Identity locked - won\'t auto-update'
                  : 'Re-analyzes watch history automatically'
                }
              </Typography>
            </Box>
          </Grid>
          
          {/* Franchise Size Filter */}
          <Grid item xs={12} sm={6} md={4}>
            <Box
              sx={{
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                height: '100%',
              }}
            >
              <Typography variant="body2" fontWeight={600} mb={1}>Min Franchise Size</Typography>
              <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                <Select
                  value={minFranchiseSize}
                  onChange={(e) => {
                    setMinFranchiseSize(e.target.value as number)
                    setTimeout(handleSaveSettings, 100)
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}+ {isMovie ? 'movies' : 'shows'} in library
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                Only include franchises with at least {minFranchiseSize} {isMovie ? 'movies' : 'shows'} available
              </Typography>
            </Box>
          </Grid>
          
          {/* Min Watched Filter */}
          <Grid item xs={12} sm={6} md={4}>
            <Box
              sx={{
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                height: '100%',
              }}
            >
              <Typography variant="body2" fontWeight={600} mb={1}>Min Watched</Typography>
              <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                <Select
                  value={minFranchiseItems}
                  onChange={(e) => {
                    setMinFranchiseItems(e.target.value as number)
                    setTimeout(handleSaveSettings, 100)
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}+ watched from franchise
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                You must have watched at least {minFranchiseItems} from a franchise to include it
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 2: Specific Interests & Watch History Sources (2 columns) */}
      <Grid container spacing={3}>
        {/* Left Column: Specific Interests */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <AutoAwesomeIcon sx={{ color: accentColor }} fontSize="small" />
              <Typography variant="h6" fontWeight={600}>
                Specific Interests
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Add themes, styles, or content types you enjoy to improve recommendations.
            </Typography>
            
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={interests}
              inputValue={interestInput}
              onInputChange={(_, value) => setInterestInput(value)}
              onChange={(_, newValue, reason, details) => {
                if (reason === 'createOption' && details?.option) {
                  handleAddInterest(details.option as string)
                } else if (reason === 'removeOption' && details?.option) {
                  handleRemoveInterest(details.option as string)
                }
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    onDelete={() => handleRemoveInterest(option)}
                    sx={{ m: 0.5 }}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Type an interest and press Enter"
                  size="small"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && interestInput.trim()) {
                      e.preventDefault()
                      handleAddInterest(interestInput)
                    }
                  }}
                />
              )}
            />
            
            {interests.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Examples: "Time travel stories", "Dark comedies", "Underdog sports dramas"
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Watch History Sources */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <VideoLibraryIcon sx={{ color: accentColor }} fontSize="small" />
              <Typography variant="h6" fontWeight={600}>
                {isMovie ? 'Movie' : 'Series'} Library Sources
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Choose which {isMovie ? 'movie' : 'TV show'} libraries contribute to your taste profile.
            </Typography>
            
            {loadingLibraries ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={24} />
              </Box>
            ) : accessibleLibraries.filter(l => l.collectionType === (isMovie ? 'movies' : 'tvshows')).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No {isMovie ? 'movie' : 'TV show'} libraries found.
              </Typography>
            ) : (
              <Box 
                sx={{ 
                  maxHeight: 280, 
                  overflowY: 'auto', 
                  flex: 1,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-thumb': { 
                    bgcolor: 'divider', 
                    borderRadius: 3,
                  },
                }}
              >
                <Grid container spacing={1}>
                  {accessibleLibraries
                    .filter(library => library.collectionType === (isMovie ? 'movies' : 'tvshows'))
                    .map((library) => (
                    <Grid item xs={12} sm={6} key={library.id}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: library.isExcluded ? 'divider' : accentColor,
                          bgcolor: library.isExcluded ? 'action.disabledBackground' : 'background.paper',
                          opacity: library.isExcluded ? 0.7 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} minWidth={0} flex={1}>
                          {isMovie ? (
                            <MovieIcon fontSize="small" color={library.isExcluded ? 'disabled' : 'action'} sx={{ flexShrink: 0 }} />
                          ) : (
                            <TvIcon fontSize="small" color={library.isExcluded ? 'disabled' : 'action'} sx={{ flexShrink: 0 }} />
                          )}
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            noWrap
                            sx={{ 
                              color: library.isExcluded ? 'text.disabled' : 'text.primary',
                              minWidth: 0,
                            }}
                          >
                            {library.name}
                          </Typography>
                        </Box>
                        
                        <Switch
                          checked={!library.isExcluded}
                          onChange={() => handleToggleLibrary(library.id, library.isExcluded)}
                          disabled={savingLibrary === library.id}
                          size="small"
                          sx={{
                            flexShrink: 0,
                            ml: 0.5,
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: accentColor,
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: accentColor,
                            },
                          }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              AI Picks and system libraries are automatically excluded.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Analyze button - below the 2-column section */}
      <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Box textAlign="right">
          <Button
            variant="contained"
            startIcon={analyzing ? <CircularProgress size={18} color="inherit" /> : <HistoryIcon />}
            onClick={handleAnalyzeClick}
            disabled={analyzing}
            sx={{ 
              bgcolor: accentColor,
              '&:hover': { bgcolor: accentColor, filter: 'brightness(1.1)' },
            }}
          >
            {analyzing ? 'Analyzing...' : 'Analyze Watch History'}
          </Button>
          
        </Box>
      </Paper>

      {/* Section 3: Watch History Weights */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            Watch History Weights
          </Typography>
          <Fade in={!!savingSlider}>
            <Typography variant="caption" color="text.secondary">
              Saving...
            </Typography>
          </Fade>
        </Box>
        
        <Grid container spacing={3}>
          {/* Franchise Weighting */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <LocalMoviesIcon sx={{ color: accentColor }} fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Franchise Weighting ({data?.franchises?.length || 0})
                </Typography>
              </Box>
              
              {/* Explainer */}
              <Box 
                sx={{ 
                  bgcolor: 'action.hover', 
                  borderRadius: 1, 
                  p: 1.5, 
                  mb: 2,
                  borderLeft: '3px solid',
                  borderColor: accentColor,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Adjust how much each franchise influences your recommendations. 
                  <strong> Boost</strong> to see more from franchises you love, 
                  <strong> Avoid</strong> to see less. Your settings are saved automatically.
                </Typography>
              </Box>
              
              {/* Legend */}
              <Box display="flex" justifyContent="space-between" mb={2} px={1}>
                <Typography variant="caption" color="error.main">Avoid</Typography>
                <Typography variant="caption" color="text.secondary">Neutral</Typography>
                <Typography variant="caption" color="success.main">Boost</Typography>
              </Box>
              
              {/* Scrollable slider list */}
              <Box sx={{ maxHeight: 350, overflow: 'auto', pr: 1 }}>
                {data?.franchises && data.franchises.length > 0 ? (
                  data.franchises.map((franchise) => {
                    const isNew = newItems.franchises.includes(franchise.franchiseName)
                    return (
                      <Box 
                        key={franchise.id} 
                        ref={(el: HTMLDivElement | null) => { franchiseRefs.current[franchise.franchiseName] = el }}
                        sx={{ 
                          mb: 2,
                          p: isNew ? 1 : 0,
                          borderRadius: 1,
                          border: isNew ? '2px solid' : 'none',
                          borderColor: isNew ? '#f59e0b' : 'transparent',
                          animation: isNew ? 'pulse 2s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { borderColor: '#f59e0b' },
                            '50%': { borderColor: '#fbbf24' },
                          },
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
                            <Typography 
                              variant="body2" 
                              fontWeight={500} 
                              sx={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {franchise.franchiseName}
                            </Typography>
                            {isNew && (
                              <Chip 
                                size="small" 
                                label="NEW" 
                                sx={{ 
                                  bgcolor: '#f59e0b', 
                                  color: 'white', 
                                  fontSize: '0.6rem', 
                                  height: 18,
                                  fontWeight: 700,
                                }} 
                              />
                            )}
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Chip
                              size="small"
                              label={
                                franchise.preferenceScore > 0.3 ? 'Boost' :
                                franchise.preferenceScore < -0.3 ? 'Avoid' : 'Neutral'
                              }
                              sx={{
                                bgcolor: franchise.preferenceScore > 0.3 ? 'success.main' :
                                        franchise.preferenceScore < -0.3 ? 'error.main' : 'action.selected',
                                color: Math.abs(franchise.preferenceScore) > 0.3 ? 'white' : 'text.primary',
                                fontSize: '0.7rem',
                                height: 20,
                              }}
                            />
                            <Tooltip title="Remove from list">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteFranchise(franchise.franchiseName)}
                                sx={{ 
                                  p: 0.25,
                                  opacity: 0.5,
                                  '&:hover': { opacity: 1, color: 'error.main' }
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        <Slider
                          value={franchise.preferenceScore}
                          onChange={(_, value) => handleSliderChange('franchise', franchise.id, franchise.franchiseName, value as number)}
                          min={-1}
                          max={1}
                          step={0.1}
                          size="small"
                          sx={{
                            '& .MuiSlider-track': {
                              background: franchise.preferenceScore > 0 
                                ? `linear-gradient(to right, #9ca3af, #22c55e)`
                                : `linear-gradient(to right, #ef4444, #9ca3af)`,
                            },
                            '& .MuiSlider-rail': {
                              background: 'linear-gradient(to right, #ef4444, #9ca3af, #22c55e)',
                              opacity: 0.3,
                            },
                          }}
                        />
                      </Box>
                    )
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                    No franchises detected. Click "Analyze Watch History" to scan.
                  </Typography>
                )}
              </Box>
              
              {/* New items alert */}
              {newItems.franchises.length > 0 && (
                <Alert 
                  severity="info" 
                  icon={<AutoFixHighIcon />}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="body2" fontWeight={500} mb={1}>
                    {newItems.franchises.length} new franchise{newItems.franchises.length > 1 ? 's' : ''} detected:
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {newItems.franchises.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        size="small"
                        onClick={() => scrollToItem('franchise', name)}
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: '#f59e0b',
                          color: 'white',
                          '&:hover': { bgcolor: '#d97706' },
                        }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}
            </Box>
          </Grid>
          
          {/* Genre Weighting */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TheaterComedyIcon sx={{ color: accentColor }} fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Genre Weighting ({data?.genres?.length || 0})
                </Typography>
              </Box>
              
              {/* Explainer */}
              <Box 
                sx={{ 
                  bgcolor: 'action.hover', 
                  borderRadius: 1, 
                  p: 1.5, 
                  mb: 2,
                  borderLeft: '3px solid',
                  borderColor: accentColor,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Fine-tune genre preferences to personalize discovery and recommendations. 
                  <strong> Boost</strong> genres you enjoy, 
                  <strong> Hide</strong> genres you want to avoid. Changes apply to all features.
                </Typography>
              </Box>
              
              {/* Legend */}
              <Box display="flex" justifyContent="space-between" mb={2} px={1}>
                <Typography variant="caption" color="text.secondary">Hide</Typography>
                <Typography variant="caption" color="text.secondary">Normal</Typography>
                <Typography variant="caption" color="info.main">Boost</Typography>
              </Box>
              
              {/* Scrollable slider list */}
              <Box sx={{ maxHeight: 350, overflow: 'auto', pr: 1 }}>
                {data?.genres && data.genres.length > 0 ? (
                  data.genres.map((genre) => {
                    const isNew = newItems.genres.includes(genre.genre)
                    return (
                      <Box 
                        key={genre.id} 
                        ref={(el: HTMLDivElement | null) => { genreRefs.current[genre.genre] = el }}
                        sx={{ 
                          mb: 2,
                          p: isNew ? 1 : 0,
                          borderRadius: 1,
                          border: isNew ? '2px solid' : 'none',
                          borderColor: isNew ? '#f59e0b' : 'transparent',
                          animation: isNew ? 'pulse 2s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { borderColor: '#f59e0b' },
                            '50%': { borderColor: '#fbbf24' },
                          },
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={500}>
                              {genre.genre}
                            </Typography>
                            {isNew && (
                              <Chip 
                                size="small" 
                                label="NEW" 
                                sx={{ 
                                  bgcolor: '#f59e0b', 
                                  color: 'white', 
                                  fontSize: '0.6rem', 
                                  height: 18,
                                  fontWeight: 700,
                                }} 
                              />
                            )}
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Chip
                              size="small"
                              label={
                                genre.weight > 1.3 ? 'Boost' :
                                genre.weight < 0.7 ? 'Less' : 'Normal'
                              }
                              sx={{
                                bgcolor: genre.weight > 1.3 ? 'info.main' :
                                        genre.weight < 0.7 ? 'action.hover' : 'action.selected',
                                color: genre.weight > 1.3 ? 'white' : 'text.primary',
                                fontSize: '0.7rem',
                                height: 20,
                              }}
                            />
                            <Tooltip title="Remove from list">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteGenre(genre.genre)}
                                sx={{ 
                                  p: 0.25,
                                  opacity: 0.5,
                                  '&:hover': { opacity: 1, color: 'error.main' }
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        <Slider
                          value={genre.weight}
                          onChange={(_, value) => handleSliderChange('genre', genre.id, genre.genre, value as number)}
                          min={0}
                          max={2}
                          step={0.1}
                          size="small"
                          sx={{
                            '& .MuiSlider-track': {
                              background: `linear-gradient(to right, #9ca3af, ${accentColor})`,
                            },
                            '& .MuiSlider-rail': {
                              background: `linear-gradient(to right, #374151, #9ca3af, ${accentColor})`,
                              opacity: 0.3,
                            },
                          }}
                        />
                      </Box>
                    )
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                    No genres detected. Click "Analyze Watch History" to scan.
                  </Typography>
                )}
              </Box>
              
              {/* New items alert */}
              {newItems.genres.length > 0 && (
                <Alert 
                  severity="info" 
                  icon={<AutoFixHighIcon />}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="body2" fontWeight={500} mb={1}>
                    {newItems.genres.length} new genre{newItems.genres.length > 1 ? 's' : ''} detected:
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {newItems.genres.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        size="small"
                        onClick={() => scrollToItem('genre', name)}
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: '#f59e0b',
                          color: 'white',
                          '&:hover': { bgcolor: '#d97706' },
                        }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 4: Identity Output */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${accentColor} 0%, ${isMovie ? '#8b5cf6' : '#f472b6'} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isMovie ? <MovieIcon sx={{ color: 'white', fontSize: 28 }} /> : <TvIcon sx={{ color: 'white', fontSize: 28 }} />}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {isMovie ? 'Movie' : 'TV Series'} Identity
              </Typography>
              <Typography variant="caption" color="text.secondary">
                AI-generated analysis of your viewing preferences
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleGenerateIdentity}
            disabled={generating}
            sx={{ 
              bgcolor: accentColor,
              '&:hover': { bgcolor: accentColor, filter: 'brightness(1.1)' },
            }}
          >
            {generating ? 'Generating...' : 'Generate Identity'}
          </Button>
        </Box>

        {/* Synopsis Output */}
        {displaySynopsis ? (
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              mb: 3,
            }}
          >
            <Box
              sx={{
                pl: 2,
                borderLeft: '3px solid',
                borderColor: accentColor,
                '& p': {
                  margin: 0,
                  mb: 1.5,
                  lineHeight: 1.8,
                  color: 'text.primary',
                  '&:last-child': { mb: 0 },
                },
                '& strong': {
                  color: accentColor,
                  fontWeight: 600,
                },
              }}
            >
              <Markdown>{displaySynopsis}</Markdown>
              {isStreaming && (
                <Box component="span" sx={{ 
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  bgcolor: accentColor,
                  ml: 0.5,
                  animation: 'blink 1s infinite',
                  '@keyframes blink': {
                    '0%, 50%': { opacity: 1 },
                    '51%, 100%': { opacity: 0 },
                  },
                }} />
              )}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              mb: 3,
            }}
          >
            <Typography color="text.secondary" gutterBottom>
              No identity generated yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click "Generate Identity" to create your personalized {isMovie ? 'movie' : 'TV'} profile
            </Typography>
          </Box>
        )}

        {/* Metric Widgets */}
        {stats && (
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <PlayCircleOutlineIcon sx={{ color: accentColor, fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {isMovie 
                    ? stats.totalWatched?.toLocaleString() || 0
                    : `${stats.totalSeriesStarted || 0} / ${stats.totalEpisodesWatched?.toLocaleString() || 0}`
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isMovie ? 'Movies Watched' : 'Series / Episodes'}
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <StarIcon sx={{ color: '#facc15', fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {stats.avgRating?.toFixed(1) || '—'}/10
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Avg. Rating
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <CalendarMonthIcon sx={{ color: '#22c55e', fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {stats.favoriteDecade || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Favorite Era
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <TheaterComedyIcon sx={{ color: '#f472b6', fontSize: 32, mb: 1 }} />
                <Box display="flex" gap={0.5} flexWrap="wrap" justifyContent="center" mt={1}>
                  {stats.topGenres?.slice(0, 3).map((genre) => (
                    <Chip key={genre} label={genre} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Top Genres
                </Typography>
              </Card>
            </Grid>
          </Grid>
        )}
      </Paper>
    </Box>
  )
}

