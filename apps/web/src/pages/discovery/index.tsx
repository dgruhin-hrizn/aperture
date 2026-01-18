import React, { useState, useCallback, useMemo } from 'react'
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
} from '@mui/material'
import ExploreIcon from '@mui/icons-material/Explore'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { useDiscoveryData, useJellyseerrRequest } from './hooks'
import { DiscoveryCard, DiscoveryFilters, DiscoveryListItem } from './components'
import { useViewMode } from '../../hooks/useViewMode'
import type { DiscoveryCandidate, DiscoveryFilterOptions, MediaType } from './types'

// Local storage key for persisting filter preferences
const FILTERS_STORAGE_KEY = 'aperture_discovery_filters'

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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Filter state - persisted to localStorage
  const [filters, setFilters] = useState<DiscoveryFilterOptions>(() => loadFiltersFromStorage())
  
  // Memoize filters to avoid unnecessary re-renders
  const stableFilters = useMemo(() => filters, [JSON.stringify(filters)])
  
  const {
    status,
    movieCandidates,
    seriesCandidates,
    movieRun,
    seriesRun,
    jellyseerrStatus,
    loading,
    refreshing,
    error,
    refresh,
    markAsRequested,
  } = useDiscoveryData(stableFilters)

  const { submitRequest, isRequesting } = useJellyseerrRequest()
  const { viewMode, setViewMode } = useViewMode('discovery')

  const [mediaType, setMediaType] = useState<MediaType>('movie')
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

  const candidates = mediaType === 'movie' ? movieCandidates : seriesCandidates
  const run = mediaType === 'movie' ? movieRun : seriesRun

  const handleRefresh = async () => {
    const result = await refresh(mediaType)
    if (result.success) {
      setSnackbar({ open: true, message: 'Discovery suggestions refreshed!', severity: 'success' })
    } else {
      setSnackbar({ open: true, message: result.error || 'Failed to refresh', severity: 'error' })
    }
  }

  const handleRequest = useCallback(async (candidate: DiscoveryCandidate) => {
    const result = await submitRequest(
      candidate.tmdbId,
      candidate.mediaType,
      candidate.title,
      candidate.id
    )
    if (result.success) {
      markAsRequested(candidate.tmdbId)
      setSnackbar({ open: true, message: `Request submitted for "${candidate.title}"`, severity: 'success' })
    } else {
      setSnackbar({ open: true, message: result.error || 'Failed to submit request', severity: 'error' })
    }
  }, [submitRequest, markAsRequested])

  // Not enabled state
  if (!loading && status && !status.enabled) {
    return (
      <Box>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <ExploreIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Discover
          </Typography>
        </Box>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Discovery is not enabled for your account. Contact your admin to enable missing content suggestions.
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
              Discover
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              AI-powered suggestions for content not in your library
            </Typography>
          )}
        </Box>

        {/* Grid/List toggle always in upper right */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="grid">
            <GridViewIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Action buttons row */}
      <Box display="flex" gap={1} mb={2}>
        {isMobile ? (
          <Tooltip title={refreshing ? 'Refreshing...' : 'Refresh'}>
            <span>
              <IconButton
                onClick={handleRefresh}
                disabled={refreshing}
                size="small"
                sx={{ border: 1, borderColor: 'divider' }}
              >
                {refreshing ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={mediaType}
        onChange={(_, v) => setMediaType(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab
          value="movie"
          icon={<MovieIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>Movies</span>
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
            color: mediaType === 'movie' ? '#6366f1' : 'text.secondary',
            '&.Mui-selected': { color: '#6366f1' },
          }}
        />
        <Tab
          value="series"
          icon={<TvIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>TV Series</span>
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
            color: mediaType === 'series' ? '#ec4899' : 'text.secondary',
            '&.Mui-selected': { color: '#ec4899' },
          }}
        />
      </Tabs>

      {/* Filters */}
      <DiscoveryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Run Info */}
      {run && run.createdAt && (
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Last updated: {new Date(run.createdAt).toLocaleString()}
          {run.candidatesStored != null && run.candidatesFetched != null && (
            <> • {run.candidatesStored} suggestions from {run.candidatesFetched.toLocaleString()} candidates</>
          )}
        </Typography>
      )}

      {/* Request capability notice */}
      {status?.requestEnabled ? (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          Click on any title to view on TMDb. Hover to request content via Jellyseerr.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          Content requests are not enabled for your account. You can browse suggestions but cannot request them.
        </Alert>
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
          No {mediaType === 'movie' ? 'movie' : 'series'} suggestions yet. Click "Refresh" to generate personalized recommendations based on your watch history.
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
                cachedStatus={jellyseerrStatus[candidate.tmdbId]}
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
              cachedStatus={jellyseerrStatus[candidate.tmdbId]}
            />
          ))}
        </Box>
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

