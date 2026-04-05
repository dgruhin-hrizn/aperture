import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  Chip,
  Stack,
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
  CONNECTION_COLORS,
} from '../../../components/SimilarityGraph'
import type { GraphNode, ConnectionReason, ConnectionType } from '../../../components/SimilarityGraph'
import { connectionTypeLabel } from '../../../i18n/connectionTypeLabel'
import { GraphExplorer } from '../../../components/GraphExplorer'
import type { MediaType, SimilarItem } from '../types'
import {
  DEFAULT_SIMILAR_MEDIA_LIMIT,
  FULLSCREEN_SIMILAR_GRAPH_LIMIT,
} from '../constants'

const MAX_LIST_REASON_CHIPS = 3

function ConnectionReasonChips({ reasons }: { reasons?: ConnectionReason[] }) {
  const { t } = useTranslation()
  if (!reasons?.length) return null
  const shown = reasons.slice(0, MAX_LIST_REASON_CHIPS)
  const extra = reasons.length - shown.length
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75, justifyContent: 'center' }}>
      {shown.map((r, i) => {
        const baseLabel = connectionTypeLabel(r.type as ConnectionType, t)
        const detail = r.value
          ? `${baseLabel}: ${r.value}`
          : r.values?.length
            ? `${baseLabel} (${r.values.slice(0, 2).join(', ')}${r.values.length > 2 ? '…' : ''})`
            : baseLabel
        return (
          <Tooltip key={i} title={detail}>
            <Chip
              size="small"
              label={baseLabel}
              sx={{
                height: 22,
                maxWidth: '100%',
                fontSize: '0.65rem',
                borderLeft: 3,
                borderColor: CONNECTION_COLORS[r.type] ?? 'grey.500',
                bgcolor: 'action.hover',
                '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />
          </Tooltip>
        )
      })}
      {extra > 0 && (
        <Chip size="small" label={`+${extra}`} sx={{ height: 22, fontSize: '0.65rem' }} />
      )}
    </Stack>
  )
}

interface SimilarMediaProps {
  mediaType: MediaType
  mediaId?: string
  mediaTitle?: string
  similar: SimilarItem[]
}

export function SimilarMedia({ mediaType, mediaId, mediaTitle, similar }: SimilarMediaProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list')
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
  } = useSimilarityData(mediaType, viewMode === 'graph' ? mediaId || null : null, {
    limit: DEFAULT_SIMILAR_MEDIA_LIMIT,
    depth: 1,
  })

  // Fetch expanded graph data for fullscreen (depth=3 - deep spider out effect)
  const {
    data: fullscreenGraphData,
    loading: fullscreenLoading,
    loadingStatus: fullscreenLoadingStatus,
    history: fullscreenHistory,
    setFocusId: fullscreenSetFocusId,
    goToHistoryIndex: fullscreenGoToHistoryIndex,
    startOver: fullscreenStartOver,
  } = useSimilarityData(mediaType, isFullscreen ? mediaId || null : null, {
    limit: FULLSCREEN_SIMILAR_GRAPH_LIMIT,
    depth: 3,
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/auth/me/preferences', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const prefs = await res.json()
        if (prefs.similarMediaView === 'graph' || prefs.similarMediaView === 'list') {
          setViewMode(prefs.similarMediaView)
        }
      } catch {
        // keep default list
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleViewModeChange = useCallback(async (_: unknown, v: 'list' | 'graph') => {
    setViewMode(v)
    try {
      await fetch('/api/auth/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ similarMediaView: v }),
      })
    } catch {
      // non-fatal
    }
  }, [])

  // Get current center node title
  const currentTitle =
    graphData?.nodes.find((n) => n.isCenter)?.title || mediaTitle || t('mediaDetail.similar.fallbackCenterTitle')

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
            onChange={handleViewModeChange}
            sx={{ minHeight: 36 }}
          >
            <Tab
              value="list"
              icon={<GridViewIcon fontSize="small" />}
              iconPosition="start"
              label={t('mediaDetail.similar.tabList')}
              sx={{ minHeight: 36, py: 0 }}
            />
            <Tab
              value="graph"
              icon={<BubbleChartIcon fontSize="small" />}
              iconPosition="start"
              label={t('mediaDetail.similar.tabGraph')}
              sx={{ minHeight: 36, py: 0 }}
            />
          </Tabs>

        </Box>
      </Box>

      {viewMode === 'list' ? (
        <Grid container spacing={2}>
          {similar.map((item) => (
            <Grid item xs={6} sm={4} md={3} lg={3} key={item.id}>
              <Box>
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
                <ConnectionReasonChips reasons={item.reasons} />
              </Box>
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
                <Tooltip title={t('mediaDetail.similar.tooltipStartOver')}>
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
                {t('mediaDetail.similar.graphHint')}
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
              title={
                mediaType === 'movie'
                  ? t('mediaDetail.similar.titleMovies')
                  : t('mediaDetail.similar.titleSeries')
              }
              subtitle={t('mediaDetail.similar.expandedSubtitle', {
                count: fullscreenGraphData?.nodes.length || 0,
              })}
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
