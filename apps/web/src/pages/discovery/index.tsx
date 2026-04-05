import React, { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  Alert,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Fade,
} from '@mui/material'
import ExploreIcon from '@mui/icons-material/Explore'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import {
  useDiscoveryData,
  useSeerrRequest,
  useDiscoveryJobStatus,
  invalidateDiscoveryCache,
  useDiscoveryGenres,
} from './hooks'
import {
  DiscoveryCard,
  DiscoveryFilters,
  DiscoveryListItem,
  StreamingDiscoverySection,
  TmdbGenreRowsSection,
} from './components'
import { useViewMode } from '../../hooks/useViewMode'
import type { DiscoveryCandidate, DiscoveryFilterOptions, MediaType } from './types'

type DiscoveryTab = 'movie' | 'series' | 'streaming'
import type { SeerrRequestOptions } from '../../types/seerrRequest'

// Local storage key for persisting filter preferences
const FILTERS_STORAGE_KEY = 'aperture_discovery_filters'

/** Movies / TV only: "popular" = main TMDb Discover pool; "genre" = admin genre strips */
const BROWSE_SUBTAB_STORAGE_KEY = 'aperture_discovery_browse_subtab'
type BrowseSubTab = 'popular' | 'genre'

function loadBrowseSubTabs(): { movie: BrowseSubTab; series: BrowseSubTab } {
  try {
    const raw = localStorage.getItem(BROWSE_SUBTAB_STORAGE_KEY)
    if (raw) {
      const j = JSON.parse(raw) as { movie?: string; series?: string }
      return {
        movie: j.movie === 'genre' ? 'genre' : 'popular',
        series: j.series === 'genre' ? 'genre' : 'popular',
      }
    }
  } catch {
    // ignore
  }
  return { movie: 'popular', series: 'popular' }
}

function saveBrowseSubTabs(movie: BrowseSubTab, series: BrowseSubTab) {
  try {
    localStorage.setItem(BROWSE_SUBTAB_STORAGE_KEY, JSON.stringify({ movie, series }))
  } catch {
    // ignore
  }
}

function loadFiltersFromStorage(): DiscoveryFilterOptions {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function saveFiltersToStorage(filters: DiscoveryFilterOptions) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Storage full or unavailable
  }
}

export function DiscoveryPage() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Filter state - persisted to localStorage
  const [filters, setFilters] = useState<DiscoveryFilterOptions>(() => loadFiltersFromStorage())

  // Memoize filters to avoid unnecessary re-renders (deep comparison via JSON key)
  const filtersKey = JSON.stringify(filters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilters = useMemo(() => filters, [filtersKey])

  const {
    status,
    movieCandidates,
    seriesCandidates,
    movieRun,
    seriesRun,
    seerrStatus,
    loading,
    refreshing,
    expanding,
    error,
    refresh,
    markAsRequested,
    refetchCandidates,
  } = useDiscoveryData(stableFilters)

  const { submitRequest, isRequesting, fetchTVDetails } = useSeerrRequest()

  // Subscribe to discovery job status for real-time updates
  const { isRunning: isJobRunning, progress: jobProgress } = useDiscoveryJobStatus({
    onComplete: () => {
      // Invalidate cache and refetch when job completes
      invalidateDiscoveryCache()
      refetchCandidates()
      setSnackbar({
        open: true,
        message: t('discovery.snackbarReady'),
        severity: 'success',
      })
    },
  })
  const { viewMode, setViewMode } = useViewMode('discovery')

  const [discoveryTab, setDiscoveryTab] = useState<DiscoveryTab>('movie')
  const initialBrowse = loadBrowseSubTabs()
  const [browseSubMovie, setBrowseSubMovie] = useState<BrowseSubTab>(initialBrowse.movie)
  const [browseSubSeries, setBrowseSubSeries] = useState<BrowseSubTab>(initialBrowse.series)
  const browseSubTab: BrowseSubTab =
    discoveryTab === 'series' ? browseSubSeries : discoveryTab === 'movie' ? browseSubMovie : 'popular'
  const genreMediaType: MediaType = discoveryTab === 'series' ? 'series' : 'movie'
  const { genres: genreOptions, loading: genresLoading, resolveGenreName } =
    useDiscoveryGenres(genreMediaType)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Handle filter changes with localStorage persistence
  const handleFiltersChange = useCallback((newFilters: DiscoveryFilterOptions) => {
    setFilters(newFilters)
    saveFiltersToStorage(newFilters)
  }, [])

  const candidates =
    discoveryTab === 'movie' ? movieCandidates : discoveryTab === 'series' ? seriesCandidates : []
  const run = discoveryTab === 'movie' ? movieRun : discoveryTab === 'series' ? seriesRun : null

  const handleBrowseSubChange = useCallback(
    (_: React.SyntheticEvent, v: BrowseSubTab | null) => {
      if (v == null) return
      if (discoveryTab === 'movie') {
        setBrowseSubMovie(v)
        saveBrowseSubTabs(v, browseSubSeries)
      } else if (discoveryTab === 'series') {
        setBrowseSubSeries(v)
        saveBrowseSubTabs(browseSubMovie, v)
      }
    },
    [discoveryTab, browseSubMovie, browseSubSeries]
  )

  const handleRefresh = async () => {
    if (discoveryTab === 'streaming') return
    const result = await refresh(discoveryTab)
    if (result.success) {
      setSnackbar({ open: true, message: t('discovery.snackbarRefreshed'), severity: 'success' })
    } else {
      setSnackbar({ open: true, message: result.error || t('discovery.snackbarRefreshFailed'), severity: 'error' })
    }
  }

  const handleRequest = useCallback(async (
    candidate: DiscoveryCandidate,
    seasons?: number[],
    seerrOptions?: SeerrRequestOptions
  ) => {
    const result = await submitRequest(
      candidate.tmdbId,
      candidate.mediaType,
      candidate.title,
      candidate.id,
      seasons,
      seerrOptions
    )
    if (result.success) {
      markAsRequested(candidate.tmdbId)
      setSnackbar({
        open: true,
        message: t('discovery.snackbarRequestSubmitted', { title: candidate.title }),
        severity: 'success',
      })
    } else {
      setSnackbar({ open: true, message: result.error || t('discovery.snackbarRequestFailed'), severity: 'error' })
    }
  }, [submitRequest, markAsRequested, t])

  // Not enabled state
  if (!loading && status && !status.enabled) {
    return (
      <Box>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <ExploreIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            {t('discovery.title')}
          </Typography>
        </Box>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t('discovery.disabledBody')}
        </Alert>
      </Box>
    )
  }

  const LoadingSkeleton = () => (
    <Grid container spacing={2}>
      {[...Array(12)].map((_, i) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 2 }} />
          <Skeleton variant="text" sx={{ mt: 1 }} />
          <Skeleton variant="text" width="60%" />
        </Grid>
      ))}
    </Grid>
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={{ xs: 0, sm: 1 }}>
            <ExploreIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              {t('discovery.title')}
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              {t('discovery.subtitle')}
            </Typography>
          )}
        </Box>

        {/* Grid/List toggle — main pool only, not genre strips or Streaming */}
        {discoveryTab !== 'streaming' && browseSubTab === 'popular' && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            aria-label={t('discovery.title')}
          >
            <ToggleButton value="grid" aria-label={t('discovery.gridView')}>
              <GridViewIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label={t('discovery.listView')}>
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Action buttons row — refresh applies to the main discovery pool */}
      {discoveryTab !== 'streaming' && browseSubTab === 'popular' && (
        <Box display="flex" gap={1} mb={2}>
          {isMobile ? (
            <Tooltip
              title={
                isJobRunning ? t('discovery.jobRunning') : refreshing ? t('discovery.refreshing') : t('discovery.refresh')
              }
            >
              <span>
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing || isJobRunning}
                  size="small"
                  sx={{ border: 1, borderColor: 'divider' }}
                >
                  {refreshing || isJobRunning ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="outlined"
              startIcon={refreshing || isJobRunning ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleRefresh}
              disabled={refreshing || isJobRunning}
              size="small"
            >
              {isJobRunning
                ? t('discovery.jobRunningLabel')
                : refreshing
                  ? t('discovery.refreshing')
                  : t('discovery.refresh')}
            </Button>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={discoveryTab}
        onChange={(_, v) => setDiscoveryTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab
          value="movie"
          icon={<MovieIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>{t('discovery.tabMovies')}</span>
              {movieCandidates.length > 0 && (
                <Chip
                  label={movieCandidates.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: '#6366f1',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
          sx={{
            color: discoveryTab === 'movie' ? '#6366f1' : 'text.secondary',
            '&.Mui-selected': { color: '#6366f1' },
          }}
        />
        <Tab
          value="series"
          icon={<TvIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>{t('discovery.tabSeries')}</span>
              {seriesCandidates.length > 0 && (
                <Chip
                  label={seriesCandidates.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: '#ec4899',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
          sx={{
            color: discoveryTab === 'series' ? '#ec4899' : 'text.secondary',
            '&.Mui-selected': { color: '#ec4899' },
          }}
        />
        {status?.streamingDiscoveryEnabled && (
          <Tab
            value="streaming"
            icon={<LiveTvIcon />}
            iconPosition="start"
            label={t('discovery.tabStreaming')}
            sx={{
              color: discoveryTab === 'streaming' ? 'primary.main' : 'text.secondary',
              '&.Mui-selected': { color: 'primary.main' },
            }}
          />
        )}
      </Tabs>

      {/* Movies / TV: browse by overall popularity vs genre strips */}
      {(discoveryTab === 'movie' || discoveryTab === 'series') && (
        <Tabs
          value={browseSubTab}
          onChange={handleBrowseSubChange}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, minHeight: 40 }}
        >
          <Tab value="popular" label={t('discovery.tabBrowsePopular')} sx={{ textTransform: 'none' }} />
          <Tab value="genre" label={t('discovery.tabBrowseGenre')} sx={{ textTransform: 'none' }} />
        </Tabs>
      )}

      {discoveryTab === 'streaming' ? (
        <StreamingDiscoverySection requestEnabled={status?.requestEnabled ?? false} />
      ) : browseSubTab === 'genre' ? (
        <TmdbGenreRowsSection
          mediaType={discoveryTab === 'series' ? 'series' : 'movie'}
          requestEnabled={status?.requestEnabled ?? false}
          resolveGenreName={resolveGenreName}
        />
      ) : (
        <>
          {/* Filters — main TMDb Discover pool */}
          <DiscoveryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            genreOptions={genreOptions}
            genresLoading={genresLoading}
          />

      {/* Job Running Banner */}
      <Fade in={isJobRunning} timeout={300}>
        <Alert
          severity="info"
          icon={<AutorenewIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {t('discovery.jobBanner')}
            </Typography>
            {jobProgress && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {jobProgress.currentStep}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={jobProgress.overallProgress}
                  sx={{ mt: 0.5, height: 4, borderRadius: 1 }}
                />
              </Box>
            )}
          </Box>
        </Alert>
      </Fade>

      {/* Run Info */}
      {run && run.createdAt && (
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          {t('discovery.lastUpdated', { when: new Date(run.createdAt).toLocaleString() })}
          {run.candidatesStored != null && run.candidatesFetched != null && (
            <>
              {' '}
              •{' '}
              {t('discovery.runMeta', {
                stored: run.candidatesStored,
                fetched: run.candidatesFetched.toLocaleString(),
              })}
            </>
          )}
        </Typography>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <LoadingSkeleton />
      ) : candidates.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {discoveryTab === 'movie' ? t('discovery.emptyMovie') : t('discovery.emptySeries')}
        </Alert>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {candidates.map((candidate) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={candidate.id}>
              <DiscoveryCard
                candidate={candidate}
                canRequest={status?.requestEnabled ?? false}
                onRequest={handleRequest}
                isRequesting={isRequesting(candidate.tmdbId)}
                cachedStatus={seerrStatus[candidate.tmdbId]}
                fetchTVDetails={fetchTVDetails}
                resolveGenreName={resolveGenreName}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {candidates.map((candidate) => (
            <DiscoveryListItem
              key={candidate.id}
              candidate={candidate}
              canRequest={status?.requestEnabled ?? false}
              onRequest={handleRequest}
              isRequesting={isRequesting(candidate.tmdbId)}
              cachedStatus={seerrStatus[candidate.tmdbId]}
              fetchTVDetails={fetchTVDetails}
              resolveGenreName={resolveGenreName}
            />
          ))}
        </Box>
      )}

      {/* Expanding indicator - shown when dynamically fetching more candidates */}
      <Fade in={expanding} timeout={300}>
        <Box sx={{ mt: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={1}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {t('discovery.expanding')}
            </Typography>
          </Box>
          <LinearProgress
            sx={{
              borderRadius: 1,
              height: 4,
              bgcolor: 'action.hover',
            }}
          />
        </Box>
      </Fade>
        </>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default DiscoveryPage

