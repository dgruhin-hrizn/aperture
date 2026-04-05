/**
 * Shows You Watch Page
 * 
 * Displays and manages the user's watching series list.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  Skeleton,
  Snackbar,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import TvIcon from '@mui/icons-material/Tv'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { useWatchingData } from './hooks'
import { useUserRatings } from '../../hooks/useUserRatings'
import { useViewMode } from '../../hooks/useViewMode'
import { WatchingCard, WatchingListItem, AddSeriesDialog } from './components'

type FilterType = 'all' | 'airing' | 'upcoming'

export function WatchingPage() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { series, loading, error, refreshing, removeSeries, refreshLibrary, refetch } = useWatchingData()
  const { getRating, setRating } = useUserRatings()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'warning' | 'info'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [filter, setFilter] = useState<FilterType>('upcoming')
  const { viewMode, setViewMode } = useViewMode('watching')

  const handleRemove = async (seriesId: string) => {
    try {
      await removeSeries(seriesId)
      setSnackbar({ open: true, message: t('watching.removedSuccess'), severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: t('watching.removeFailed'), severity: 'error' })
    }
  }

  const handleRefresh = async () => {
    try {
      const result = await refreshLibrary()
      if (!result.success) {
        setSnackbar({ open: true, message: result.message || t('watching.syncFailed'), severity: 'error' })
        return
      }
      if (result.skipped) {
        setSnackbar({ open: true, message: result.message, severity: 'warning' })
        return
      }
      const detail: string[] = []
      if (result.pushedToServer > 0) detail.push(t('watching.detailFavorited', { count: result.pushedToServer }))
      if (result.removedFromDb > 0) detail.push(t('watching.detailRemovedLocal', { count: result.removedFromDb }))
      if (result.pulledIntoDb > 0) detail.push(t('watching.detailAddedFromServer', { count: result.pulledIntoDb }))
      if (result.pushErrors > 0) detail.push(t('watching.detailPushErrors', { count: result.pushErrors }))
      const message =
        detail.length > 0 ? `${result.message} (${detail.join(', ')})` : result.message
      setSnackbar({ open: true, message, severity: 'success' })
      await refetch()
    } catch {
      setSnackbar({ open: true, message: t('watching.syncFavoritesFailed'), severity: 'error' })
    }
  }

  const handleAddClose = () => {
    setAddDialogOpen(false)
    refetch()
  }

  const filteredSeries = series
    .filter((s) => {
      if (filter === 'airing') return s.status === 'Continuing'
      if (filter === 'upcoming') return s.upcomingEpisode !== null
      return true
    })
    .sort((a, b) => {
      // Sort by upcoming episode air date (soonest first)
      // Series without upcoming episodes go to the end
      if (a.upcomingEpisode && b.upcomingEpisode) {
        return new Date(a.upcomingEpisode.airDate).getTime() - new Date(b.upcomingEpisode.airDate).getTime()
      }
      if (a.upcomingEpisode) return -1
      if (b.upcomingEpisode) return 1
      return 0
    })

  const airingCount = series.filter((s) => s.status === 'Continuing').length
  const upcomingCount = series.filter((s) => s.upcomingEpisode !== null).length

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          {t('nav.showsYouWatch')}
        </Typography>
        <Box display="flex" flexDirection="column" gap={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={150} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        mb={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} mb={{ xs: 0, sm: 0.5 }}>
            {t('nav.showsYouWatch')}
          </Typography>
          {!isMobile && (
            <Typography variant="body2" color="text.secondary">
              {t('watching.subtitle')}
            </Typography>
          )}
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          {/* Grid/List toggle always in upper right */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
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
      </Box>

      {/* Action buttons row */}
      <Box display="flex" gap={1} mb={2}>
        {isMobile ? (
          <>
            <Tooltip title={refreshing ? t('watching.tooltipSyncing') : t('watching.tooltipSyncFavorites')}>
              <span>
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing || series.length === 0}
                  size="small"
                  sx={{ border: 1, borderColor: 'divider' }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('watching.tooltipAddSeries')}>
              <IconButton
                onClick={() => setAddDialogOpen(true)}
                size="small"
                color="primary"
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={refreshing || series.length === 0}
              size="small"
            >
              {refreshing ? t('watching.tooltipSyncing') : t('watching.syncFavorites')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              size="small"
            >
              {t('watching.addSeries')}
            </Button>
          </>
        )}
      </Box>

      {/* Stats & Controls */}
      {series.length > 0 && (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={2}
          mb={3}
        >
          {/* Stats - hidden on mobile since counts are in tabs */}
          {!isMobile && (
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                icon={<TvIcon />}
                label={t('watching.chipSeriesCount', { count: series.length })}
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<TvIcon />}
                label={t('watching.chipAiring', { count: airingCount })}
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<CalendarTodayIcon />}
                label={t('watching.chipUpcoming', { count: upcomingCount })}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
          )}

          {/* Filter Controls */}
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, value) => value && setFilter(value)}
            size="small"
            fullWidth={isMobile}
          >
            <ToggleButton value="all">
              {t('watching.filterAll', { count: series.length })}
            </ToggleButton>
            <ToggleButton value="airing" sx={{ color: filter === 'airing' ? 'success.main' : undefined }}>
              {t('watching.filterAiring', { count: airingCount })}
            </ToggleButton>
            <ToggleButton value="upcoming" sx={{ color: filter === 'upcoming' ? 'primary.main' : undefined }}>
              {t('watching.filterUpcoming', { count: upcomingCount })}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {series.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 3,
            backgroundColor: 'background.paper',
            borderRadius: 3,
          }}
        >
          <TvIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {t('watching.emptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {t('watching.emptyBody')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            {t('watching.addFirstSeries')}
          </Button>
        </Box>
      ) : filteredSeries.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            px: 3,
            backgroundColor: 'background.paper',
            borderRadius: 3,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            {t('watching.noMatchFilter')}
          </Typography>
        </Box>
      ) : viewMode === 'list' ? (
        /* List View */
        <Box display="flex" flexDirection="column" gap={2}>
          {filteredSeries.map((item) => (
            <WatchingListItem
              key={item.id}
              series={item}
              userRating={getRating('series', item.seriesId)}
              onRate={(rating) => setRating('series', item.seriesId, rating)}
              onRemove={handleRemove}
            />
          ))}
        </Box>
      ) : (
        /* Grid View */
        <Grid container spacing={2}>
          {filteredSeries.map((item) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={item.id}>
              <WatchingCard series={item} onRemove={handleRemove} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Dialog */}
      <AddSeriesDialog open={addDialogOpen} onClose={handleAddClose} />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
