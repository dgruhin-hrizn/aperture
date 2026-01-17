import { useCallback, useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
  Paper,
  Dialog,
  Snackbar,
  Alert,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MoviePoster } from '@aperture/ui'
import GridViewIcon from '@mui/icons-material/GridView'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import HomeIcon from '@mui/icons-material/Home'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined'
import { useUserRatings } from '../../../hooks/useUserRatings'
import { useWatching } from '../../../hooks/useWatching'
import {
  SimilarityGraph,
  GraphLegend,
  useSimilarityData,
} from '../../../components/SimilarityGraph'
import type { GraphNode } from '../../../components/SimilarityGraph'
import { GraphExplorer } from '../../../components/GraphExplorer'
import type { MediaType, SimilarItem } from '../types'

interface SimilarMediaProps {
  mediaType: MediaType
  mediaId?: string
  mediaTitle?: string
  similar: SimilarItem[]
}

export function SimilarMedia({ mediaType, mediaId, mediaTitle, similar }: SimilarMediaProps) {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('graph')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Fetch graph data with rabbit-hole navigation support (depth=1 for compact view)
  const {
    data: graphData,
    loading: graphLoading,
    loadingStatus: graphLoadingStatus,
    history,
    setFocusId,
    goToHistoryIndex,
    startOver,
  } = useSimilarityData(mediaType, viewMode === 'graph' ? mediaId || null : null, { limit: 10, depth: 1 })

  // Fetch expanded graph data for fullscreen (depth=3 - deep spider out effect)
  const {
    data: fullscreenGraphData,
    loading: fullscreenLoading,
    loadingStatus: fullscreenLoadingStatus,
    history: fullscreenHistory,
    setFocusId: fullscreenSetFocusId,
    goToHistoryIndex: fullscreenGoToHistoryIndex,
    startOver: fullscreenStartOver,
  } = useSimilarityData(mediaType, isFullscreen ? mediaId || null : null, { limit: 12, depth: 3 })

  // Get current center node title
  const currentTitle = graphData?.nodes.find((n) => n.isCenter)?.title || mediaTitle || 'Media'

  const handleRate = useCallback(
    async (itemId: string, rating: number | null) => {
      try {
        await setRating(mediaType === 'movie' ? 'movie' : 'series', itemId, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating, mediaType]
  )

  const handleNodeClick = (node: GraphNode) => {
    // Rabbit hole navigation - click to refocus
    if (!node.isCenter) {
      setFocusId(node.id, node.type)
    }
  }

  const handleNodeDoubleClick = (node: GraphNode) => {
    // Double-click navigates to the detail page
    if (node.type === 'movie') {
      navigate(`/movies/${node.id}`)
    } else {
      navigate(`/series/${node.id}`)
    }
  }

  const handleFullscreenNodeClick = useCallback(
    (node: GraphNode) => {
      if (!node.isCenter) {
        fullscreenSetFocusId(node.id, node.type)
      }
    },
    [fullscreenSetFocusId]
  )

  if (similar.length === 0 && !mediaId) {
    return null
  }

  return (
    <Box>
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Typography variant="h6" fontWeight={600}>
          Similar {mediaType === 'movie' ? 'Movies' : 'Series'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tabs
            value={viewMode}
            onChange={(_, v) => setViewMode(v)}
            sx={{ minHeight: 36 }}
          >
            <Tab
              value="list"
              icon={<GridViewIcon fontSize="small" />}
              iconPosition="start"
              label="List"
              sx={{ minHeight: 36, py: 0 }}
            />
            <Tab
              value="graph"
              icon={<BubbleChartIcon fontSize="small" />}
              iconPosition="start"
              label="Graph"
              sx={{ minHeight: 36, py: 0 }}
            />
          </Tabs>

        </Box>
      </Box>

      {viewMode === 'list' ? (
        <Grid container spacing={2}>
          {similar.map((item) => (
            <Grid item xs={6} sm={4} md={3} lg={3} key={item.id}>
              <MoviePoster
                title={item.title}
                year={item.year}
                posterUrl={item.poster_url}
                genres={item.genres}
                userRating={getRating(mediaType === 'movie' ? 'movie' : 'series', item.id)}
                onRate={(rating) => handleRate(item.id, rating)}
                isWatching={mediaType === 'series' ? isWatching(item.id) : undefined}
                onWatchingToggle={
                  mediaType === 'series' ? () => toggleWatching(item.id) : undefined
                }
                hideWatchingToggle={mediaType === 'movie'}
                responsive
                onClick={() =>
                  navigate(`/${mediaType === 'movie' ? 'movies' : 'series'}/${item.id}`)
                }
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          {/* Compact graph in Paper */}
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              position: 'relative',
            }}
          >
            {/* Fullscreen button */}
            <Tooltip title="Fullscreen">
              <IconButton
                size="small"
                onClick={() => setIsFullscreen(true)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 10,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <FullscreenOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Breadcrumb navigation for rabbit-hole exploration */}
            {history.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Start over">
                  <IconButton size="small" onClick={startOver} sx={{ color: 'primary.main' }}>
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
                      onClick={() => goToHistoryIndex(index)}
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

            <SimilarityGraph
              data={graphData}
              loading={graphLoading}
              loadingStatus={graphLoadingStatus || undefined}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeDetailsClick={handleNodeDoubleClick}
              compact
            />
            <Box
              sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <GraphLegend compact />
              <Typography variant="caption" color="text.secondary">
                Click poster to explore • Click ⓘ for details
              </Typography>
            </Box>
          </Paper>

          {/* Fullscreen Dialog - uses GraphExplorer */}
          <Dialog
            open={isFullscreen}
            onClose={() => setIsFullscreen(false)}
            maxWidth={false}
            fullScreen
            PaperProps={{
              sx: {
                bgcolor: 'background.default',
                m: 0,
              },
            }}
          >
            <GraphExplorer
              data={fullscreenGraphData}
              loading={fullscreenLoading}
              loadingStatus={fullscreenLoadingStatus}
              title={`Similar ${mediaType === 'movie' ? 'Movies' : 'Series'}`}
              subtitle={`Expanded view • ${fullscreenGraphData?.nodes.length || 0} items`}
              history={fullscreenHistory}
              onHistoryNavigate={(index) =>
                index === 0 ? fullscreenStartOver() : fullscreenGoToHistoryIndex(index)
              }
              onStartOver={fullscreenStartOver}
              onNodeClick={handleFullscreenNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeDetailsClick={handleNodeDoubleClick}
              showCreatePlaylist
              showExitFullscreen
              onExitFullscreen={() => setIsFullscreen(false)}
              sourceItemId={mediaId}
              sourceItemType={mediaType}
            />
          </Dialog>
        </>
      )}

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
