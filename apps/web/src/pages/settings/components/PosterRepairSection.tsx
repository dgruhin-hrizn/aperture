import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  LinearProgress,
  Tooltip,
  Collapse,
  Paper,
  Tab,
  Tabs,
} from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'
import SearchIcon from '@mui/icons-material/Search'
import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import WarningIcon from '@mui/icons-material/Warning'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'

interface MissingPosterItem {
  id: string
  title: string
  year: number | null
  type: 'movie' | 'series'
  tmdbId: string | null
  imdbId: string | null
  hasBackdrop: boolean
}

interface RepairResult {
  id: string
  title: string
  success: boolean
  error?: string
}

interface ScanSummary {
  moviesWithMissingPosters: number
  seriesWithMissingPosters: number
  moviesWithTmdbId: number
  seriesWithTmdbId: number
  moviesRepairable: number
  seriesRepairable: number
}

export function PosterRepairSection() {
  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [movies, setMovies] = useState<MissingPosterItem[]>([])
  const [series, setSeries] = useState<MissingPosterItem[]>([])
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [scannedAt, setScannedAt] = useState<string | null>(null)

  // Selection state
  const [selectedMovies, setSelectedMovies] = useState<Set<string>>(new Set())
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set())
  const [tabValue, setTabValue] = useState(0)

  // Repair state
  const [repairing, setRepairing] = useState(false)
  const [repairProgress, setRepairProgress] = useState<{
    total: number
    completed: number
    successful: number
    failed: number
  } | null>(null)
  const [repairResults, setRepairResults] = useState<RepairResult[]>([])
  const [success, setSuccess] = useState<string | null>(null)

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanError(null)
    setSuccess(null)
    setMovies([])
    setSeries([])
    setScanSummary(null)
    setSelectedMovies(new Set())
    setSelectedSeries(new Set())
    setRepairResults([])

    try {
      const res = await fetch('/api/maintenance/posters/scan', {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to scan for missing posters')
      }

      const data = await res.json()
      setMovies(data.movies || [])
      setSeries(data.series || [])
      setScanSummary(data.summary)
      setScannedAt(data.scannedAt)

      // Auto-select all repairable items
      const repairableMovies = new Set<string>(
        (data.movies || []).filter((m: MissingPosterItem) => m.tmdbId).map((m: MissingPosterItem) => m.id)
      )
      const repairableSeries = new Set<string>(
        (data.series || []).filter((s: MissingPosterItem) => s.tmdbId).map((s: MissingPosterItem) => s.id)
      )
      setSelectedMovies(repairableMovies)
      setSelectedSeries(repairableSeries)

      if (data.totalMissing === 0) {
        setSuccess('No items with missing posters found!')
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan')
    } finally {
      setScanning(false)
    }
  }, [])

  const handleRepair = useCallback(async () => {
    const selectedItems = [
      ...movies.filter((m) => selectedMovies.has(m.id) && m.tmdbId),
      ...series.filter((s) => selectedSeries.has(s.id) && s.tmdbId),
    ]

    if (selectedItems.length === 0) {
      setScanError('No repairable items selected')
      return
    }

    setRepairing(true)
    setScanError(null)
    setSuccess(null)
    setRepairProgress({
      total: selectedItems.length,
      completed: 0,
      successful: 0,
      failed: 0,
    })
    setRepairResults([])

    try {
      const res = await fetch('/api/maintenance/posters/repair', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to repair posters')
      }

      const data = await res.json()
      setRepairProgress({
        total: data.total,
        completed: data.completed,
        successful: data.successful,
        failed: data.failed,
      })
      setRepairResults(data.results || [])

      // Remove successfully repaired items from the lists
      const repairedIds = new Set(
        data.results.filter((r: RepairResult) => r.success).map((r: RepairResult) => r.id)
      )
      setMovies((prev) => prev.filter((m) => !repairedIds.has(m.id)))
      setSeries((prev) => prev.filter((s) => !repairedIds.has(s.id)))
      setSelectedMovies((prev) => {
        const next = new Set(prev)
        repairedIds.forEach((id) => next.delete(id as string))
        return next
      })
      setSelectedSeries((prev) => {
        const next = new Set(prev)
        repairedIds.forEach((id) => next.delete(id as string))
        return next
      })

      if (data.successful > 0) {
        setSuccess(
          `Successfully repaired ${data.successful} poster${data.successful !== 1 ? 's' : ''}` +
            (data.failed > 0 ? ` (${data.failed} failed)` : '')
        )
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to repair posters')
    } finally {
      setRepairing(false)
    }
  }, [movies, series, selectedMovies, selectedSeries])

  const toggleMovieSelection = (id: string) => {
    setSelectedMovies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSeriesSelection = (id: string) => {
    setSelectedSeries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAllMovies = () => {
    const repairable = movies.filter((m) => m.tmdbId).map((m) => m.id)
    setSelectedMovies(new Set(repairable))
  }

  const selectAllSeries = () => {
    const repairable = series.filter((s) => s.tmdbId).map((s) => s.id)
    setSelectedSeries(new Set(repairable))
  }

  const deselectAllMovies = () => setSelectedMovies(new Set())
  const deselectAllSeries = () => setSelectedSeries(new Set())

  const totalSelected = selectedMovies.size + selectedSeries.size
  const totalRepairable =
    movies.filter((m) => m.tmdbId).length + series.filter((s) => s.tmdbId).length

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <ImageIcon color="primary" />
          <Typography variant="h6">Missing Poster Repair</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Scan your Emby library for movies and series with missing poster images. This tool fetches
          replacement posters from TMDB and uploads them directly to Emby—no images are stored in
          Aperture.
        </Typography>

        {scanError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setScanError(null)}>
            {scanError}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Scan Button */}
        <Box display="flex" gap={2} mb={3}>
          <Button
            variant="contained"
            startIcon={scanning ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            onClick={handleScan}
            disabled={scanning || repairing}
          >
            {scanning ? 'Scanning...' : 'Scan for Missing Posters'}
          </Button>

          {totalSelected > 0 && (
            <Button
              variant="contained"
              color="success"
              startIcon={repairing ? <CircularProgress size={20} color="inherit" /> : <BuildIcon />}
              onClick={handleRepair}
              disabled={scanning || repairing}
            >
              {repairing
                ? `Repairing ${repairProgress?.completed || 0}/${repairProgress?.total || 0}...`
                : `Repair ${totalSelected} Selected`}
            </Button>
          )}
        </Box>

        {/* Repair Progress */}
        <Collapse in={repairing || (repairProgress !== null && repairResults.length > 0)}>
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {repairing ? (
                <CircularProgress size={16} />
              ) : repairProgress?.failed === 0 ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : (
                <WarningIcon color="warning" fontSize="small" />
              )}
              <Typography variant="subtitle2" fontWeight={600}>
                {repairing ? 'Repairing Posters...' : 'Repair Complete'}
              </Typography>
            </Box>

            {repairProgress && (
              <>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {repairing 
                      ? `Processing ${repairProgress.total} items...` 
                      : `${repairProgress.completed} of ${repairProgress.total} processed`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {repairing ? '' : `${Math.round((repairProgress.completed / repairProgress.total) * 100)}%`}
                  </Typography>
                </Box>
                <LinearProgress
                  variant={repairing ? 'indeterminate' : 'determinate'}
                  value={repairing ? undefined : (repairProgress.completed / repairProgress.total) * 100}
                  sx={{ height: 6, borderRadius: 1, mb: 1 }}
                />
                {!repairing && (
                  <Box display="flex" gap={2}>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label={`${repairProgress.successful} successful`}
                      color="success"
                      variant="outlined"
                    />
                    {repairProgress.failed > 0 && (
                      <Chip
                        size="small"
                        icon={<ErrorIcon />}
                        label={`${repairProgress.failed} failed`}
                        color="error"
                        variant="outlined"
                      />
                    )}
                  </Box>
                )}
              </>
            )}

            {/* Failed results */}
            {repairResults.filter((r) => !r.success).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="error" fontWeight={600}>
                  Failed items:
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 0.5,
                    p: 1,
                    maxHeight: 150,
                    overflow: 'auto',
                    bgcolor: '#0d1117',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  {repairResults
                    .filter((r) => !r.success)
                    .map((r, i) => (
                      <Box key={i} sx={{ color: '#f85149' }}>
                        {r.title}: {r.error}
                      </Box>
                    ))}
                </Paper>
              </Box>
            )}
          </Box>
        </Collapse>

        {/* Scan Summary */}
        {scanSummary && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <PhotoLibraryIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                Scan Results
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {scannedAt && `Scanned at ${new Date(scannedAt).toLocaleTimeString()}`}
              </Typography>
            </Box>

            <Box display="flex" gap={3} flexWrap="wrap">
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <MovieIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>{scanSummary.moviesWithMissingPosters}</strong> movies missing posters
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {scanSummary.moviesRepairable} can be repaired (have TMDB ID)
                </Typography>
              </Box>
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TvIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>{scanSummary.seriesWithMissingPosters}</strong> series missing posters
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {scanSummary.seriesRepairable} can be repaired (have TMDB ID)
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Results Tabs */}
        {(movies.length > 0 || series.length > 0) && (
          <>
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              <Tab
                icon={<MovieIcon />}
                iconPosition="start"
                label={`Movies (${movies.length})`}
                sx={{ textTransform: 'none' }}
              />
              <Tab
                icon={<TvIcon />}
                iconPosition="start"
                label={`Series (${series.length})`}
                sx={{ textTransform: 'none' }}
              />
            </Tabs>

            {/* Movies Tab */}
            {tabValue === 0 && (
              <Box>
                {movies.length === 0 ? (
                  <Alert severity="success">No movies with missing posters!</Alert>
                ) : (
                  <>
                    <Box display="flex" gap={1} mb={2}>
                      <Button size="small" variant="outlined" onClick={selectAllMovies}>
                        Select All Repairable
                      </Button>
                      <Button size="small" variant="outlined" onClick={deselectAllMovies}>
                        Deselect All
                      </Button>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                        {selectedMovies.size} selected
                      </Typography>
                    </Box>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">
                              <Checkbox
                                indeterminate={
                                  selectedMovies.size > 0 &&
                                  selectedMovies.size < movies.filter((m) => m.tmdbId).length
                                }
                                checked={
                                  selectedMovies.size > 0 &&
                                  selectedMovies.size === movies.filter((m) => m.tmdbId).length
                                }
                                onChange={() =>
                                  selectedMovies.size === movies.filter((m) => m.tmdbId).length
                                    ? deselectAllMovies()
                                    : selectAllMovies()
                                }
                              />
                            </TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Year</TableCell>
                            <TableCell>TMDB ID</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {movies.map((movie) => (
                            <TableRow
                              key={movie.id}
                              hover
                              sx={{ opacity: movie.tmdbId ? 1 : 0.5 }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedMovies.has(movie.id)}
                                  onChange={() => toggleMovieSelection(movie.id)}
                                  disabled={!movie.tmdbId}
                                />
                              </TableCell>
                              <TableCell>{movie.title}</TableCell>
                              <TableCell>{movie.year || '—'}</TableCell>
                              <TableCell>
                                {movie.tmdbId ? (
                                  <Chip
                                    size="small"
                                    label={movie.tmdbId}
                                    variant="outlined"
                                    sx={{ height: 20 }}
                                  />
                                ) : (
                                  <Tooltip title="Cannot repair without TMDB ID">
                                    <Chip
                                      size="small"
                                      label="Missing"
                                      color="error"
                                      variant="outlined"
                                      sx={{ height: 20 }}
                                    />
                                  </Tooltip>
                                )}
                              </TableCell>
                              <TableCell>
                                {movie.tmdbId ? (
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleIcon />}
                                    label="Repairable"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<ErrorIcon />}
                                    label="Not Repairable"
                                    color="error"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Box>
            )}

            {/* Series Tab */}
            {tabValue === 1 && (
              <Box>
                {series.length === 0 ? (
                  <Alert severity="success">No series with missing posters!</Alert>
                ) : (
                  <>
                    <Box display="flex" gap={1} mb={2}>
                      <Button size="small" variant="outlined" onClick={selectAllSeries}>
                        Select All Repairable
                      </Button>
                      <Button size="small" variant="outlined" onClick={deselectAllSeries}>
                        Deselect All
                      </Button>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                        {selectedSeries.size} selected
                      </Typography>
                    </Box>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">
                              <Checkbox
                                indeterminate={
                                  selectedSeries.size > 0 &&
                                  selectedSeries.size < series.filter((s) => s.tmdbId).length
                                }
                                checked={
                                  selectedSeries.size > 0 &&
                                  selectedSeries.size === series.filter((s) => s.tmdbId).length
                                }
                                onChange={() =>
                                  selectedSeries.size === series.filter((s) => s.tmdbId).length
                                    ? deselectAllSeries()
                                    : selectAllSeries()
                                }
                              />
                            </TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Year</TableCell>
                            <TableCell>TMDB ID</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {series.map((show) => (
                            <TableRow
                              key={show.id}
                              hover
                              sx={{ opacity: show.tmdbId ? 1 : 0.5 }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedSeries.has(show.id)}
                                  onChange={() => toggleSeriesSelection(show.id)}
                                  disabled={!show.tmdbId}
                                />
                              </TableCell>
                              <TableCell>{show.title}</TableCell>
                              <TableCell>{show.year || '—'}</TableCell>
                              <TableCell>
                                {show.tmdbId ? (
                                  <Chip
                                    size="small"
                                    label={show.tmdbId}
                                    variant="outlined"
                                    sx={{ height: 20 }}
                                  />
                                ) : (
                                  <Tooltip title="Cannot repair without TMDB ID">
                                    <Chip
                                      size="small"
                                      label="Missing"
                                      color="error"
                                      variant="outlined"
                                      sx={{ height: 20 }}
                                    />
                                  </Tooltip>
                                )}
                              </TableCell>
                              <TableCell>
                                {show.tmdbId ? (
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleIcon />}
                                    label="Repairable"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<ErrorIcon />}
                                    label="Not Repairable"
                                    color="error"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Box>
            )}

            {/* Bottom action bar */}
            {totalRepairable > 0 && (
              <Box
                sx={{
                  mt: 2,
                  pt: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {totalSelected} of {totalRepairable} repairable items selected
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={repairing ? <CircularProgress size={20} color="inherit" /> : <BuildIcon />}
                  onClick={handleRepair}
                  disabled={scanning || repairing || totalSelected === 0}
                >
                  {repairing
                    ? `Repairing ${repairProgress?.completed || 0}/${repairProgress?.total || 0}...`
                    : `Repair ${totalSelected} Selected`}
                </Button>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

