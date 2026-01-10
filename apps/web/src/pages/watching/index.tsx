/**
 * Shows You Watch Page
 * 
 * Displays and manages the user's watching series list.
 */

import { useState } from 'react'
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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import TvIcon from '@mui/icons-material/Tv'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useWatchingData } from './hooks'
import { WatchingCard, AddSeriesDialog } from './components'

type FilterType = 'all' | 'airing' | 'upcoming'

export function WatchingPage() {
  const { series, loading, error, refreshing, removeSeries, refreshLibrary, refetch } = useWatchingData()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [filter, setFilter] = useState<FilterType>('upcoming')

  const handleRemove = async (seriesId: string) => {
    try {
      await removeSeries(seriesId)
      setSnackbar({ open: true, message: 'Removed from watching list', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove series', severity: 'error' })
    }
  }

  const handleRefresh = async () => {
    try {
      const result = await refreshLibrary()
      setSnackbar({
        open: true,
        message: result.libraryCreated
          ? `Library created with ${result.written} series`
          : `Library updated with ${result.written} series`,
        severity: 'success',
      })
    } catch {
      setSnackbar({ open: true, message: 'Failed to refresh library', severity: 'error' })
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
          Shows You Watch
        </Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item key={i}>
              <Box sx={{ width: 160 }}>
                <Skeleton variant="rectangular" width={160} height={240} sx={{ borderRadius: 2 }} />
                <Skeleton width="80%" sx={{ mt: 1 }} />
                <Skeleton width="40%" />
                <Skeleton variant="rectangular" height={50} sx={{ mt: 1, borderRadius: 1 }} />
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={0.5}>
            Shows You Watch
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track series you're currently watching and see upcoming episodes
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing || series.length === 0}
          >
            {refreshing ? 'Refreshing...' : 'Sync to Emby'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Series
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      {series.length > 0 && (
        <Box display="flex" gap={2} mb={3}>
          <Chip
            icon={<TvIcon />}
            label={`${series.length} Series`}
            variant="outlined"
          />
          <Chip
            icon={<TvIcon />}
            label={`${airingCount} Currently Airing`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<CalendarTodayIcon />}
            label={`${upcomingCount} with Upcoming Episodes`}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* Filters */}
      {series.length > 0 && (
        <Box mb={3}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, value) => value && setFilter(value)}
            size="small"
          >
            <ToggleButton value="all">
              All ({series.length})
            </ToggleButton>
            <ToggleButton value="airing">
              Currently Airing ({airingCount})
            </ToggleButton>
            <ToggleButton value="upcoming">
              With Upcoming ({upcomingCount})
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
            borderRadius: 2,
          }}
        >
          <TvIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No series in your watching list yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Add series you're currently watching to track them and see upcoming episodes.
            Your watching list will be synced to Emby as a personal library.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Your First Series
          </Button>
        </Box>
      ) : filteredSeries.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            px: 3,
            backgroundColor: 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No series match the current filter
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredSeries.map((item) => (
            <Grid item key={item.id}>
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

