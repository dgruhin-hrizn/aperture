import { useState, useCallback, useEffect } from 'react'
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
  Breadcrumbs,
  Link,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import ClearIcon from '@mui/icons-material/Clear'
import HomeIcon from '@mui/icons-material/Home'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import {
  SimilarityGraph,
  useGraphData,
  useSimilarityData,
  type GraphNode,
  type GraphData,
  type LoadingStatus,
} from '../../components/SimilarityGraph'
import { CONNECTION_COLORS, CONNECTION_LABELS, type ConnectionType } from '../../components/SimilarityGraph/types'

type GraphSource = 'ai-movies' | 'ai-series' | 'watching' | 'top-movies' | 'top-series'
type MediaFilter = 'movie' | 'series' | 'both'

const RECENT_SEARCHES_KEY = 'aperture_recent_searches'
const MAX_RECENT_SEARCHES = 5

interface SemanticSearchState {
  query: string
  loading: boolean
  results: GraphData | null
}

export function ExplorePage() {
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
  const [navigationHistory, setNavigationHistory] = useState<
    Array<{ id: string; type: 'movie' | 'series'; title: string }>
  >([])

  // Semantic search state
  const [semanticSearch, setSemanticSearch] = useState<SemanticSearchState>({
    query: '',
    loading: false,
    results: null,
  })

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

  // Fetch similarity data for a focused item
  const {
    data: focusedData,
    loading: focusedLoading,
    loadingStatus: focusedLoadingStatus,
    history,
    setFocusId,
    goToHistoryIndex,
    startOver,
  } = useSimilarityData(focusedItemType || 'movie', focusedItemId, { limit: 15 })

  // Determine what data to display
  const getDisplayData = (): { data: GraphData | null; loading: boolean; loadingStatus: LoadingStatus | null } => {
    if (semanticSearch.results) {
      return { data: semanticSearch.results, loading: semanticSearch.loading, loadingStatus: semanticSearch.loading ? { phase: 'validating', message: 'Searching library...', progress: 50 } : null }
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
  const handleSemanticSearch = async (query: string) => {
    if (!query.trim()) return

    setSemanticSearch({ query, loading: true, results: null })
    saveRecentSearch(query)

    // Clear other states
    setFocusedItemId(null)
    setFocusedItemType(null)
    setSelectedBrowseSource(null)
    setNavigationHistory([])

    try {
      const params = new URLSearchParams({
        q: query,
        type: mediaFilter,
        limit: '20',
        graph: 'true',
      })

      const response = await fetch(`/api/similarity/search?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const result = await response.json()
      setSemanticSearch({
        query,
        loading: false,
        results: result.graph,
      })
    } catch (error) {
      console.error('Semantic search failed:', error)
      setSemanticSearch({ query, loading: false, results: null })
    }
  }

  // Handle browse source selection
  const handleBrowseSourceSelect = (source: GraphSource) => {
    setSelectedBrowseSource(source)
    setSemanticSearch({ query: '', loading: false, results: null })
    setFocusedItemId(null)
    setFocusedItemType(null)
    setNavigationHistory([])
    setSearchQuery('')
  }

  // Handle node click (rabbit-hole navigation)
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isCenter) return

      // Track history
      const currentCenter = displayData?.nodes.find((n) => n.isCenter)
      if (currentCenter) {
        setNavigationHistory((prev) => [
          ...prev,
          { id: currentCenter.id, type: currentCenter.type, title: currentCenter.title },
        ])
      }

      // If we're in semantic search mode, switch to focused mode
      if (semanticSearch.results) {
        setSemanticSearch({ query: '', loading: false, results: null })
      }

      setFocusedItemId(node.id)
      setFocusedItemType(node.type)
      setFocusId(node.id, node.type)
    },
    [displayData, semanticSearch.results, setFocusId]
  )

  const handleNodeDoubleClick = useCallback(
    (node: GraphNode) => {
      navigate(`/${node.type === 'movie' ? 'movies' : 'series'}/${node.id}`)
    },
    [navigate]
  )

  // Handle going back in history
  const handleHistoryBack = (index: number) => {
    const item = navigationHistory[index]
    // Remove everything after this index
    setNavigationHistory(navigationHistory.slice(0, index))
    setFocusedItemId(item.id)
    setFocusedItemType(item.type)
    goToHistoryIndex(index)
  }

  // Handle start over
  const handleStartOver = () => {
    setNavigationHistory([])
    if (semanticSearch.query) {
      // Re-run the search
      handleSemanticSearch(semanticSearch.query)
    } else {
      setFocusedItemId(null)
      setFocusedItemType(null)
      startOver()
    }
  }

  // Clear recent search
  const clearRecentSearch = (query: string) => {
    const updated = recentSearches.filter((s) => s !== query)
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  // Get current title for breadcrumb
  const currentTitle =
    displayData?.nodes.find((n) => n.isCenter)?.title ||
    (semanticSearch.query ? `"${semanticSearch.query}"` : 'Select a source')

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
      {/* Main Graph Area - Now on the left */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Breadcrumb Navigation */}
        {(navigationHistory.length > 0 || semanticSearch.query) && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(139, 92, 246, 0.03)',
            }}
          >
            <Tooltip title="Start over">
              <IconButton size="small" onClick={handleStartOver} sx={{ color: 'primary.main' }}>
                <HomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              sx={{
                '& .MuiBreadcrumbs-separator': { mx: 0.5 },
                '& .MuiBreadcrumbs-li': { fontSize: '0.875rem' },
              }}
            >
              {semanticSearch.query && (
                <Typography variant="body2" color="text.secondary">
                  Search: "{semanticSearch.query}"
                </Typography>
              )}
              {navigationHistory.map((item, index) => (
                <Link
                  key={`${item.id}-${index}`}
                  component="button"
                  variant="body2"
                  onClick={() => handleHistoryBack(index)}
                  sx={{
                    cursor: 'pointer',
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  {item.title}
                </Link>
              ))}
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                {currentTitle}
              </Typography>
            </Breadcrumbs>
          </Box>
        )}

        {/* Graph */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          {!displayData && !loading ? (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                color: 'text.secondary',
              }}
            >
              <SearchIcon sx={{ fontSize: 64, opacity: 0.3 }} />
              <Typography variant="h6">Discover Your Library</Typography>
              <Typography variant="body2" textAlign="center" maxWidth={400}>
                Search for content using natural language or select a browse category from the panel on the right.
              </Typography>
            </Box>
          ) : (
            <SimilarityGraph
              data={displayData}
              loading={loading}
              loadingStatus={loadingStatus || undefined}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          )}
        </Box>

        {/* Bottom Bar - Instructions */}
        <Paper
          sx={{
            px: 2,
            py: 1,
            borderRadius: 0,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            <strong>Click</strong> to explore connections
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Double-click</strong> to view details
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Drag</strong> to reposition
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Scroll</strong> to zoom
          </Typography>
        </Paper>
      </Box>

      {/* Right Sidebar - Controls */}
      <Paper
        sx={{
          width: 300,
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
        {/* Search Box - Prominent */}
        <Box sx={{ p: 2, bgcolor: 'rgba(139, 92, 246, 0.05)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                handleSemanticSearch(searchQuery)
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="primary" />
                </InputAdornment>
              ),
              endAdornment: semanticSearch.loading ? (
                <CircularProgress size={16} />
              ) : searchQuery ? (
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              ) : null,
              sx: {
                bgcolor: 'background.paper',
                '&:hover': { bgcolor: 'background.paper' },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, lineHeight: 1.4 }}>
            Use natural language to find content by mood, theme, or description. Examples:
          </Typography>
          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip 
              label="Psychological thrillers" 
              size="small" 
              variant="outlined"
              onClick={() => { setSearchQuery('Psychological thrillers'); handleSemanticSearch('Psychological thrillers'); }}
              sx={{ fontSize: '0.65rem', height: 22, cursor: 'pointer' }}
            />
            <Chip 
              label="Feel-good comedies" 
              size="small" 
              variant="outlined"
              onClick={() => { setSearchQuery('Feel-good comedies'); handleSemanticSearch('Feel-good comedies'); }}
              sx={{ fontSize: '0.65rem', height: 22, cursor: 'pointer' }}
            />
            <Chip 
              label="Mind-bending sci-fi" 
              size="small" 
              variant="outlined"
              onClick={() => { setSearchQuery('Mind-bending sci-fi'); handleSemanticSearch('Mind-bending sci-fi'); }}
              sx={{ fontSize: '0.65rem', height: 22, cursor: 'pointer' }}
            />
          </Box>
        </Box>

        {/* Quick Filters */}
        <Box sx={{ px: 2, py: 1.5 }}>
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
              Movies
            </ToggleButton>
            <ToggleButton value="series">
              <TvIcon fontSize="small" sx={{ mr: 0.5 }} />
              Series
            </ToggleButton>
            <ToggleButton value="both">Both</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* Browse By Section */}
        <Box>
          <ListItemButton onClick={() => setBrowseSectionOpen(!browseSectionOpen)}>
            <ListItemText
              primary="Browse By"
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
                <ListItemText primary="My AI Movie Picks" />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'ai-series'}
                onClick={() => handleBrowseSourceSelect('ai-series')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <AutoAwesomeIcon fontSize="small" color="secondary" />
                </ListItemIcon>
                <ListItemText primary="My AI Series Picks" />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'watching'}
                onClick={() => handleBrowseSourceSelect('watching')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <PlaylistPlayIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Shows You Watch" />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'top-movies'}
                onClick={() => handleBrowseSourceSelect('top-movies')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Top Picks Movies" />
              </ListItemButton>

              <ListItemButton
                selected={selectedBrowseSource === 'top-series'}
                onClick={() => handleBrowseSourceSelect('top-series')}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TrendingUpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Top Picks Series" />
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
                Recent Searches
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
            Connection Types
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
                  {CONNECTION_LABELS[type]}
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
            label={
              <Typography variant="caption">Show cross-media connections</Typography>
            }
          />
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Refresh Button */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Tooltip title="Refresh graph">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Box>
  )
}
