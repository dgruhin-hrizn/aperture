/**
 * GraphExplorer - Reusable full-screen graph exploration component
 * 
 * Used by:
 * - SimilarMedia (fullscreen mode) - for exploring similar content
 * - ExplorePage - main exploration interface with search
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Button,
  Breadcrumbs,
  Link,
  CircularProgress,
  Chip,
  Snackbar,
  Alert,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import HomeIcon from '@mui/icons-material/Home'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  SimilarityGraph,
  GraphLegend,
  type GraphData,
  type GraphNode,
  type LoadingStatus,
} from '../SimilarityGraph'
import { CreatePlaylistDialog } from '../CreatePlaylistDialog'

// Extended breadcrumb type that supports 'search' in addition to 'movie' | 'series'
export interface GraphBreadcrumbItem {
  id: string
  title: string
  type: 'movie' | 'series' | 'search'
}

export interface GraphExplorerProps {
  // Graph data
  data: GraphData | null
  loading: boolean
  loadingStatus?: LoadingStatus | null

  // Title and display
  title?: string
  subtitle?: string
  itemCount?: number

  // Navigation history
  history: GraphBreadcrumbItem[]
  onHistoryNavigate: (index: number) => void
  onStartOver: () => void

  // Node interactions
  onNodeClick: (node: GraphNode) => void
  onNodeDoubleClick?: (node: GraphNode) => void
  onNodeDetailsClick?: (node: GraphNode) => void

  // Search (optional)
  showSearch?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onSearch?: (query: string) => void
  onSearchClear?: () => void
  searchPlaceholder?: string
  searchLoading?: boolean
  searchExamples?: string[]

  // Actions
  showCreatePlaylist?: boolean
  showExitFullscreen?: boolean
  onExitFullscreen?: () => void
  showRefresh?: boolean
  onRefresh?: () => void

  // Playlist source info (for CreatePlaylistDialog)
  sourceItemId?: string
  sourceItemType?: 'movie' | 'series'

  // Styling
  compact?: boolean
}

export function GraphExplorer({
  data,
  loading,
  loadingStatus,
  title,
  subtitle,
  itemCount,
  history,
  onHistoryNavigate,
  onStartOver,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDetailsClick,
  showSearch = false,
  searchQuery = '',
  onSearchChange,
  onSearch,
  onSearchClear,
  searchPlaceholder,
  searchLoading = false,
  searchExamples,
  showCreatePlaylist = true,
  showExitFullscreen = false,
  onExitFullscreen,
  showRefresh = false,
  onRefresh,
  sourceItemId,
  sourceItemType,
  compact = false,
}: GraphExplorerProps) {
  const { t } = useTranslation()
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync local search query with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery)
  }, [searchQuery])

  // Get current center node title
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('graphExplorer.searchPlaceholderDefault')
  const currentTitle = data?.nodes.find((n) => n.isCenter)?.title || title || t('graphExplorer.fallbackTitle')
  const displayItemCount = itemCount ?? data?.nodes.length ?? 0

  const handleSearchSubmit = useCallback(() => {
    if (localSearchQuery.trim() && onSearch) {
      onSearch(localSearchQuery.trim())
    }
  }, [localSearchQuery, onSearch])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearchSubmit()
      }
    },
    [handleSearchSubmit]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setLocalSearchQuery(value)
      onSearchChange?.(value)
    },
    [onSearchChange]
  )

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery('')
    onSearchChange?.('')
    onSearchClear?.()
    searchInputRef.current?.focus()
  }, [onSearchChange, onSearchClear])

  const handleExampleClick = useCallback(
    (example: string) => {
      setLocalSearchQuery(example)
      onSearchChange?.(example)
      onSearch?.(example)
    },
    [onSearchChange, onSearch]
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 1.5, md: 2 },
          py: { xs: 1.5, md: 2 },
          px: { xs: 2, md: 3 },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {/* Left side: Search or Title + Breadcrumbs */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {showSearch ? (
            <>
              <TextField
                ref={searchInputRef}
                size="small"
                placeholder={resolvedSearchPlaceholder}
                value={localSearchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="primary" />
                    </InputAdornment>
                  ),
                  endAdornment: searchLoading ? (
                    <CircularProgress size={16} />
                  ) : localSearchQuery ? (
                    <IconButton size="small" onClick={handleClearSearch}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  ) : null,
                }}
                sx={{ maxWidth: { md: 500 } }}
              />
              {searchExamples && searchExamples.length > 0 && !localSearchQuery && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, alignSelf: 'center' }}>
                    {t('graphExplorer.tryHint')}
                  </Typography>
                  {searchExamples.map((example) => (
                    <Chip
                      key={example}
                      label={example}
                      size="small"
                      variant="outlined"
                      onClick={() => handleExampleClick(example)}
                      sx={{ fontSize: '0.65rem', height: 22, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                {title || t('graphExplorer.similarContentFallback')}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {subtitle}
                </Typography>
              )}
              {displayItemCount > 0 && !subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  • {t('graphExplorer.itemCount', { count: displayItemCount })}
                </Typography>
              )}
            </Box>
          )}

          {/* Breadcrumb navigation */}
          {history.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={t('graphExplorer.startOver')}>
                <IconButton size="small" onClick={onStartOver} sx={{ color: 'primary.main' }}>
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
                {history.map((item, index) => (
                  <Link
                    key={item.id}
                    component="button"
                    variant="body2"
                    onClick={() => onHistoryNavigate(index)}
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
        </Box>

        {/* Right side: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {showRefresh && onRefresh && (
            <Tooltip title={t('graphExplorer.refresh')}>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {showCreatePlaylist && (
            <Tooltip title={t('graphExplorer.createPlaylistTooltip')}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlaylistAddIcon />}
                onClick={() => setPlaylistDialogOpen(true)}
                disabled={!data || data.nodes.length === 0}
                sx={{
                  fontSize: { xs: '0.75rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                }}
              >
                {t('graphExplorer.createPlaylist')}
              </Button>
            </Tooltip>
          )}
          {showExitFullscreen && onExitFullscreen && (
            <Tooltip title={t('graphExplorer.exitFullscreen')}>
              <IconButton onClick={onExitFullscreen}>
                <FullscreenExitIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Graph Area */}
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <SimilarityGraph
          data={data}
          loading={loading}
          loadingStatus={loadingStatus || undefined}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDetailsClick={onNodeDetailsClick}
          compact={compact}
        />
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1,
        }}
      >
        <GraphLegend compact={compact} />
        <Typography
          variant={compact ? 'caption' : 'body2'}
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          {t('graphExplorer.hintsDesktop')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
          {t('graphExplorer.hintsMobile')}
        </Typography>
      </Box>

      {/* Create Playlist Dialog */}
      <CreatePlaylistDialog
        open={playlistDialogOpen}
        onClose={() => setPlaylistDialogOpen(false)}
        nodes={
          data?.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            year: n.year,
            type: n.type,
            poster_url: n.poster_url,
          })) || []
        }
        sourceItemId={sourceItemId}
        sourceItemType={sourceItemType}
        onSuccess={() => {
          setSnackbar({
            open: true,
            message: t('graphExplorer.playlistCreated'),
            severity: 'success',
          })
          setPlaylistDialogOpen(false)
        }}
      />

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

