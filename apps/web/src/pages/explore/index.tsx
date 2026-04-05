import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  Divider,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  CircularProgress,
  Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import ClearIcon from '@mui/icons-material/Clear'
import {
  useGraphData,
  useSimilarityData,
  type GraphNode,
  type GraphData,
  type LoadingStatus,
} from '../../components/SimilarityGraph'
import { CONNECTION_COLORS, type ConnectionType } from '../../components/SimilarityGraph/types'
import { connectionTypeLabel } from '../../i18n/connectionTypeLabel'
import { GraphExplorer } from '../../components/GraphExplorer'

type GraphSource = 'ai-movies' | 'ai-series' | 'watching' | 'top-movies' | 'top-series'
type MediaFilter = 'movie' | 'series' | 'both'

const RECENT_SEARCHES_KEY = 'aperture_recent_searches'
const MAX_RECENT_SEARCHES = 5

interface SemanticSearchState {
  query: string
  loading: boolean
  results: GraphData | null
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function ExplorePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get initial state from URL params
  const initialType = searchParams.get('type') as 'movie' | 'series' | null
  const initialId = searchParams.get('id')
  const initialFocus = searchParams.get('focus')

  // Parse focus param (format: "movie:123" or "series:456")
  const parseFocus = (focus: string | null): { id: string; type: 'movie' | 'series' } | null => {
    if (!focus) return null
    const [type, id] = focus.split(':')
    if ((type === 'movie' || type === 'series') && id) {
      return { id, type }
    }
    return null
  }

  const initialFocusParsed = parseFocus(initialFocus)

  // State
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('both')
  const [crossMediaEnabled, setCrossMediaEnabled] = useState(false)
  const [hideWatched, setHideWatched] = useState(true) // Default to hiding watched content
  const [searchQuery, setSearchQuery] = useState('')
  const [browseSectionOpen, setBrowseSectionOpen] = useState(true)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [selectedBrowseSource, setSelectedBrowseSource] = useState<GraphSource | null>(null)

  // Focus state for rabbit-hole navigation
  const [focusedItemId, setFocusedItemId] = useState<string | null>(
    initialFocusParsed?.id || initialId || null
  )
  const [focusedItemType, setFocusedItemType] = useState<'movie' | 'series' | null>(
    initialFocusParsed?.type || initialType || null
  )

  // Breadcrumb history for drill-down navigation (tracks across search and focused modes)
  const [breadcrumbHistory, setBreadcrumbHistory] = useState<Array<{
    id: string
    title: string
    type: 'movie' | 'series' | 'search'
  }>>([])

  // Semantic search state
  const [semanticSearch, setSemanticSearch] = useState<SemanticSearchState>({
    query: '',
    loading: false,
    results: null,
  })
  const [semanticLoadingStatus, setSemanticLoadingStatus] = useState<LoadingStatus | null>(null)
  const semanticLoadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const semanticPhaseStartRef = useRef<number>(0)

  const semanticPhases = useMemo(
    () => ({
      searching: {
        messages: [
          t('mediaGraph.semanticSearchingMsg1'),
          t('mediaGraph.semanticSearchingMsg2'),
          t('mediaGraph.semanticSearchingMsg3'),
        ],
        details: [
          t('mediaGraph.semanticSearchingDetail1'),
          t('mediaGraph.semanticSearchingDetail2'),
          t('mediaGraph.semanticSearchingDetail3'),
        ],
      },
      clustering: {
        messages: [
          t('mediaGraph.semanticClusteringMsg1'),
          t('mediaGraph.semanticClusteringMsg2'),
          t('mediaGraph.semanticClusteringMsg3'),
        ],
        details: [
          t('mediaGraph.semanticClusteringDetail1'),
          t('mediaGraph.semanticClusteringDetail2'),
          t('mediaGraph.semanticClusteringDetail3'),
        ],
      },
      building: {
        messages: [
          t('mediaGraph.semanticBuildingMsg1'),
          t('mediaGraph.semanticBuildingMsg2'),
          t('mediaGraph.semanticBuildingMsg3'),
        ],
        details: [t('mediaGraph.semanticBuildingDetail1'), t('mediaGraph.semanticBuildingDetail2')],
      },
    }),
    [t]
  )

  // Start semantic search loading animation
  const startSemanticLoadingProgress = useCallback(() => {
    semanticPhaseStartRef.current = Date.now()
    setSemanticLoadingStatus({
      phase: 'fetching',
      message: randomItem(semanticPhases.searching.messages),
      progress: 5,
    })

    semanticLoadingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - semanticPhaseStartRef.current

      setSemanticLoadingStatus(() => {
        // Searching phase (0-2s, 0-30%)
        if (elapsed < 2000) {
          return {
            phase: 'fetching',
            message: randomItem(semanticPhases.searching.messages),
            detail: randomItem(semanticPhases.searching.details),
            progress: Math.min(30, 5 + (elapsed / 2000) * 25),
          }
        }
        // AI Clustering phase (2-6s, 30-80%)
        if (elapsed < 6000) {
          const progress = 30 + ((elapsed - 2000) / 4000) * 50
          return {
            phase: 'validating',
            message: randomItem(semanticPhases.clustering.messages),
            detail: randomItem(semanticPhases.clustering.details),
            progress: Math.min(80, progress),
          }
        }
        // Building phase (6s+, 80-95%)
        return {
          phase: 'building',
          message: randomItem(semanticPhases.building.messages),
          detail: randomItem(semanticPhases.building.details),
          progress: Math.min(95, 80 + ((elapsed - 6000) / 3000) * 15),
        }
      })
    }, 300)
  }, [semanticPhases])

  const stopSemanticLoadingProgress = useCallback(() => {
    if (semanticLoadingTimerRef.current) {
      clearInterval(semanticLoadingTimerRef.current)
      semanticLoadingTimerRef.current = null
    }
    setSemanticLoadingStatus(null)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (semanticLoadingTimerRef.current) {
        clearInterval(semanticLoadingTimerRef.current)
      }
    }
  }, [])

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      MAX_RECENT_SEARCHES
    )
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  // Fetch graph data for browse sources
  const { data: browseData, loading: browseLoading, loadingStatus: browseLoadingStatus, refetch } = useGraphData(
    selectedBrowseSource || 'ai-movies',
    {
      limit: 20,
      crossMedia: crossMediaEnabled,
    }
  )

  // Fetch similarity data for a focused item (with rabbit-hole navigation)
  const {
    data: focusedData,
    loading: focusedLoading,
    loadingStatus: focusedLoadingStatus,
    setFocusId,
    startOver,
  } = useSimilarityData(focusedItemType || 'movie', focusedItemId, { limit: 15, depth: 3 })

  // Determine what data to display
  const getDisplayData = (): { data: GraphData | null; loading: boolean; loadingStatus: LoadingStatus | null } => {
    // Semantic search takes priority when loading or has results
    if (semanticSearch.loading) {
      return { data: null, loading: true, loadingStatus: semanticLoadingStatus }
    }
    if (semanticSearch.results) {
      return { data: semanticSearch.results, loading: false, loadingStatus: null }
    }
    if (focusedItemId) {
      return { data: focusedData, loading: focusedLoading, loadingStatus: focusedLoadingStatus }
    }
    if (selectedBrowseSource) {
      return { data: browseData, loading: browseLoading, loadingStatus: browseLoadingStatus }
    }
    return { data: null, loading: false, loadingStatus: null }
  }

  const { data: displayData, loading, loadingStatus } = getDisplayData()

  // Update URL when focus changes
  useEffect(() => {
    if (focusedItemId && focusedItemType) {
      setSearchParams({ focus: `${focusedItemType}:${focusedItemId}` }, { replace: true })
    } else if (searchParams.has('focus') || searchParams.has('id') || searchParams.has('type')) {
      setSearchParams({}, { replace: true })
    }
  }, [focusedItemId, focusedItemType, setSearchParams, searchParams])

  // Handle semantic search
  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setSemanticSearch({ query, loading: true, results: null })
    startSemanticLoadingProgress()
    saveRecentSearch(query)

    // Clear other states
    setFocusedItemId(null)
    setFocusedItemType(null)
    setSelectedBrowseSource(null)

    try {
      const params = new URLSearchParams({
        q: query,
        type: mediaFilter,
        limit: '20',
        graph: 'true',
        hideWatched: hideWatched.toString(),
      })

      const response = await fetch(`/api/similarity/search?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const result = await response.json()
      stopSemanticLoadingProgress()
      setSemanticSearch({
        query,
        loading: false,
        results: result.graph,
      })
    } catch (error) {
      console.error('Semantic search failed:', error)
      stopSemanticLoadingProgress()
      setSemanticSearch({ query, loading: false, results: null })
    }
  }, [mediaFilter, hideWatched, startSemanticLoadingProgress, stopSemanticLoadingProgress])

  // Handle browse source selection
  const handleBrowseSourceSelect = (source: GraphSource) => {
    setSelectedBrowseSource(source)
    setSemanticSearch({ query: '', loading: false, results: null })
    setFocusedItemId(null)
    setFocusedItemType(null)
    setSearchQuery('')
  }

  // Handle node click (rabbit-hole navigation)
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isCenter) return

      // Track the current state in breadcrumb history before navigating
      if (semanticSearch.results && semanticSearch.query) {
        // Coming from semantic search - add search as starting point
        setBreadcrumbHistory([{
          id: 'search',
          title: `"${semanticSearch.query}"`,
          type: 'search',
        }])
        setSemanticSearch({ query: '', loading: false, results: null })
      } else if (displayData?.nodes) {
        // Coming from focused view - add current center to history
        const centerNode = displayData.nodes.find(n => n.isCenter)
        if (centerNode) {
          setBreadcrumbHistory(prev => [...prev, {
            id: centerNode.id,
            title: centerNode.title,
            type: centerNode.type,
          }])
        }
      }

      setFocusedItemId(node.id)
      setFocusedItemType(node.type)
      setFocusId(node.id, node.type)
    },
    [semanticSearch.results, semanticSearch.query, displayData, setFocusId]
  )

  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      navigate(`/${node.type === 'movie' ? 'movies' : 'series'}/${node.id}`)
    },
    [navigate]
  )

  // Handle history navigation (breadcrumb click)
  const handleHistoryNavigate = useCallback(
    (index: number) => {
      const item = breadcrumbHistory[index]
      if (!item) return

      if (item.type === 'search') {
        // Go back to search results - re-run the search
        const searchQuery = item.title.replace(/^"|"$/g, '') // Remove quotes
        handleSemanticSearch(searchQuery)
        setBreadcrumbHistory([])
      } else {
        // Go back to a specific item
        setFocusedItemId(item.id)
        setFocusedItemType(item.type)
        setFocusId(item.id, item.type)
        // Remove everything after this index
        setBreadcrumbHistory(prev => prev.slice(0, index))
      }
    },
    [breadcrumbHistory, handleSemanticSearch, setFocusId]
  )

  // Handle start over (home button)
  const handleStartOver = useCallback(() => {
    // Check if first breadcrumb is a search
    if (breadcrumbHistory.length > 0 && breadcrumbHistory[0].type === 'search') {
      const searchQuery = breadcrumbHistory[0].title.replace(/^"|"$/g, '')
      handleSemanticSearch(searchQuery)
    }
    setBreadcrumbHistory([])
    setFocusedItemId(null)
    setFocusedItemType(null)
    startOver()
  }, [breadcrumbHistory, handleSemanticSearch, startOver])

  // Handle clearing the search (clears results too)
  const handleSearchClear = useCallback(() => {
    setSemanticSearch({ query: '', loading: false, results: null })
    setFocusedItemId(null)
    setFocusedItemType(null)
    setBreadcrumbHistory([])
  }, [])

  // Clear recent search
  const clearRecentSearch = (query: string) => {
    const updated = recentSearches.filter((s) => s !== query)
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  // Handle refresh - re-run current search or refetch browse source
  const handleRefresh = useCallback(() => {
    if (semanticSearch.query) {
      // Re-run the semantic search
      handleSemanticSearch(semanticSearch.query)
    } else if (selectedBrowseSource) {
      // Refetch browse source data
      refetch()
    }
  }, [semanticSearch.query, handleSemanticSearch, selectedBrowseSource, refetch])

  // Determine if refresh should be shown
  const showRefreshButton = !!(semanticSearch.results || selectedBrowseSource || focusedItemId)

  const graphTitle = useMemo(() => {
    if (semanticSearch.query) {
      return t('mediaGraph.titleSearch', { query: semanticSearch.query })
    }
    if (selectedBrowseSource) {
      const sourceKeys: Record<GraphSource, string> = {
        'ai-movies': 'mediaGraph.sourceAiMovies',
        'ai-series': 'mediaGraph.sourceAiSeries',
        watching: 'mediaGraph.sourceWatching',
        'top-movies': 'mediaGraph.sourceTopMovies',
        'top-series': 'mediaGraph.sourceTopSeries',
      }
      return t(sourceKeys[selectedBrowseSource])
    }
    return t('mediaGraph.titleDefault')
  }, [semanticSearch.query, selectedBrowseSource, t])

  const searchExamples = useMemo(
    () => [t('mediaGraph.example1'), t('mediaGraph.example2'), t('mediaGraph.example3')],
    [t]
  )

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        height: 'calc(100vh - 64px)', 
        // Break out of parent Layout padding
        m: { xs: -2, sm: -3 },
        width: { xs: 'calc(100% + 32px)', sm: 'calc(100% + 48px)' },
      }}
    >
      {/* Main Graph Area - Always uses GraphExplorer */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <GraphExplorer
          data={displayData}
          loading={loading}
          loadingStatus={loadingStatus}
          title={graphTitle}
          history={breadcrumbHistory}
          onHistoryNavigate={handleHistoryNavigate}
          onStartOver={handleStartOver}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDetailsClick={handleNodeDoubleClick}
          showSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSemanticSearch}
          onSearchClear={handleSearchClear}
          searchPlaceholder={t('mediaGraph.searchPlaceholder')}
          searchLoading={semanticSearch.loading}
          searchExamples={searchExamples}
          showCreatePlaylist
          showRefresh={showRefreshButton}
          onRefresh={handleRefresh}
        />
      </Box>

      {/* Right Sidebar - Controls */}
      <Paper
        sx={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          height: '100%',
          overflowY: 'auto',
        }}
      >
        {/* Quick Filters */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('mediaGraph.filterByType')}
          </Typography>
          <ToggleButtonGroup
            value={mediaFilter}
            exclusive
            onChange={(_, value) => value && setMediaFilter(value)}
            size="small"
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                py: 0.5,
                fontSize: '0.75rem',
              },
            }}
          >
            <ToggleButton value="movie">
              <MovieIcon fontSize="small" sx={{ mr: 0.5 }} />
              {t('mediaGraph.movies')}
            </ToggleButton>
            <ToggleButton value="series">
              <TvIcon fontSize="small" sx={{ mr: 0.5 }} />
              {t('mediaGraph.series')}
            </ToggleButton>
            <ToggleButton value="both">{t('mediaGraph.both')}</ToggleButton>
          </ToggleButtonGroup>

          {/* Hide Watched Toggle */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hideWatched}
                onChange={(e) => setHideWatched(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                {t('mediaGraph.hideWatched')}
              </Typography>
            }
            sx={{ mt: 1.5, ml: 0 }}
          />
        </Box>

        <Divider />

        {/* Browse By Section */}
        <Box>
          <ListItemButton onClick={() => setBrowseSectionOpen(!browseSectionOpen)}>
            <ListItemText
              primary={t('mediaGraph.browseBy')}
              primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
            />
            {browseSectionOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>

          <Collapse in={browseSectionOpen}>
            <List dense disablePadding>
              <ListItemButton
                selected={selectedBrowseSource === 'ai-movies'}
                onClick={() => handleBrowseSourceSelect('ai-movies')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <AutoAwesomeIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText primary={t('mediaGraph.sourceAiMovies')} />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'ai-series'}
                onClick={() => handleBrowseSourceSelect('ai-series')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <AutoAwesomeIcon fontSize="small" color="secondary" />
                </ListItemIcon>
                <ListItemText primary={t('mediaGraph.sourceAiSeries')} />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'watching'}
                onClick={() => handleBrowseSourceSelect('watching')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <PlaylistPlayIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('mediaGraph.sourceWatching')} />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'top-movies'}
                onClick={() => handleBrowseSourceSelect('top-movies')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('mediaGraph.sourceTopMovies')} />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'top-series'}
                onClick={() => handleBrowseSourceSelect('top-series')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('mediaGraph.sourceTopSeries')} />
              </ListItemButton>
            </List>
          </Collapse>
        </Box>

        <Divider />

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <HistoryIcon fontSize="small" />
                {t('mediaGraph.recentSearches')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {recentSearches.map((query) => (
                  <Chip
                    key={query}
                    label={query}
                    size="small"
                    onClick={() => {
                      setSearchQuery(query)
                      handleSemanticSearch(query)
                    }}
                    onDelete={() => clearRecentSearch(query)}
                    sx={{ fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            </Box>
            <Divider />
          </>
        )}

        {/* Connection Legend */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            {t('mediaGraph.connectionTypesHeading')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(Object.keys(CONNECTION_COLORS) as ConnectionType[]).map((type) => (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 3,
                    bgcolor: CONNECTION_COLORS[type],
                    borderRadius: 1,
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '10px' }}>
                  {connectionTypeLabel(type, t)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider />

        {/* Cross-Media Toggle */}
        <Box sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={crossMediaEnabled}
                onChange={(e) => setCrossMediaEnabled(e.target.checked)}
              />
            }
            label={<Typography variant="caption">{t('mediaGraph.crossMedia')}</Typography>}
          />
        </Box>
      </Paper>
    </Box>
  )
}
