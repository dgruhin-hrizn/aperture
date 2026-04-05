import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
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
  const { t } = useTranslation()

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

  // Job progress tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobLogs, setJobLogs] = useState<Array<{ level: string; message: string }>>([])
  const [showLogs, setShowLogs] = useState(false)
  const pollIntervalRef = useRef<number | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Poll for job progress
  const formatRepairSuccess = useCallback(
    (successful: number, failed: number) => {
      if (failed > 0) {
        return t('topPicksAdmin.posterRepair.repairSuccessWithFailed', {
          successful,
          failed,
          count: successful,
        })
      }
      return t('topPicksAdmin.posterRepair.repairSuccess', { count: successful })
    },
    [t]
  )

  const pollJobProgress = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/progress/${jobId}`, { credentials: 'include' })
      
      if (!res.ok) {
        if (res.status === 404) {
          // Job might have finished and been cleaned up
          setActiveJobId(null)
          setRepairing(false)
          return
        }
        return
      }

      const data = await res.json()
      
      // Update progress from job data
      setRepairProgress({
        total: data.itemsTotal || 0,
        completed: data.itemsProcessed || 0,
        successful: data.result?.successful || 0,
        failed: data.result?.failed || 0,
      })

      // Update logs
      if (data.logs) {
        setJobLogs(data.logs)
      }

      // Auto-scroll logs
      if (logsEndRef.current?.parentElement && showLogs) {
        const container = logsEndRef.current.parentElement
        container.scrollTop = container.scrollHeight
      }

      // Check if job is complete
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        setActiveJobId(null)
        setRepairing(false)

        if (data.status === 'completed') {
          const result = data.result || {}
          setRepairProgress({
            total: result.total || data.itemsTotal || 0,
            completed: result.total || data.itemsTotal || 0,
            successful: result.successful || 0,
            failed: result.failed || 0,
          })
          
          // Remove successfully repaired items from the lists
          // We don't have individual results from the async API, so just refresh counts
          if (result.successful > 0) {
            setSuccess(formatRepairSuccess(result.successful, result.failed || 0))
            // Clear the lists since we repaired items
            setMovies([])
            setSeries([])
            setSelectedMovies(new Set())
            setSelectedSeries(new Set())
          }
        } else if (data.status === 'failed') {
          setScanError(data.error || t('topPicksAdmin.posterRepair.repairFailed'))
        }
      }
    } catch (err) {
      console.error('Failed to poll job progress:', err)
    }
  }, [showLogs, t, formatRepairSuccess])

  // Set up polling when job is active
  useEffect(() => {
    if (activeJobId) {
      // Poll immediately
      pollJobProgress(activeJobId)

      // Set up interval
      pollIntervalRef.current = window.setInterval(() => {
        pollJobProgress(activeJobId)
      }, 500) // Poll every 500ms for snappy updates

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
  }, [activeJobId, pollJobProgress])

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
        throw new Error(data.error || t('topPicksAdmin.posterRepair.scanFailed'))
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
        setSuccess(t('topPicksAdmin.posterRepair.noMissingFound'))
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t('topPicksAdmin.posterRepair.scanFailedGeneric'))
    } finally {
      setScanning(false)
    }
  }, [t])

  const handleRepair = useCallback(async () => {
    const selectedItems = [
      ...movies.filter((m) => selectedMovies.has(m.id) && m.tmdbId),
      ...series.filter((s) => selectedSeries.has(s.id) && s.tmdbId),
    ]

    if (selectedItems.length === 0) {
      setScanError(t('topPicksAdmin.posterRepair.noRepairableSelected'))
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
    setJobLogs([])
    setShowLogs(true)

    try {
      const res = await fetch('/api/maintenance/posters/repair', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('topPicksAdmin.posterRepair.startRepairFailed'))
      }

      const data = await res.json()
      
      // API returns jobId for async tracking
      if (data.jobId) {
        setActiveJobId(data.jobId)
        setRepairProgress({
          total: data.total || selectedItems.length,
          completed: 0,
          successful: 0,
          failed: 0,
        })
      } else {
        // Fallback for sync response (shouldn't happen with new API)
        setRepairing(false)
        if (data.successful > 0) {
          setSuccess(formatRepairSuccess(data.successful, data.failed || 0))
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t('topPicksAdmin.posterRepair.startRepairFailed'))
      setRepairing(false)
    }
  }, [movies, series, selectedMovies, selectedSeries, t, formatRepairSuccess])

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
          <Typography variant="h6">{t('topPicksAdmin.posterRepair.title')}</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('topPicksAdmin.posterRepair.description')}
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
            {scanning ? t('topPicksAdmin.posterRepair.scanning') : t('topPicksAdmin.posterRepair.scan')}
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
                ? t('topPicksAdmin.posterRepair.repairing', {
                    completed: repairProgress?.completed || 0,
                    total: repairProgress?.total || 0,
                  })
                : t('topPicksAdmin.posterRepair.repairSelected', { count: totalSelected })}
            </Button>
          )}
        </Box>

        {/* Repair Progress */}
        <Collapse in={repairing || (repairProgress !== null && repairProgress.completed > 0)}>
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                {repairing ? (
                  <CircularProgress size={16} />
                ) : repairProgress?.failed === 0 ? (
                  <CheckCircleIcon color="success" fontSize="small" />
                ) : (
                  <WarningIcon color="warning" fontSize="small" />
                )}
                <Typography variant="subtitle2" fontWeight={600}>
                  {repairing
                    ? t('topPicksAdmin.posterRepair.repairingTitle')
                    : t('topPicksAdmin.posterRepair.repairComplete')}
                </Typography>
              </Box>
              {jobLogs.length > 0 && (
                <Button size="small" onClick={() => setShowLogs(!showLogs)}>
                  {showLogs ? t('topPicksAdmin.posterRepair.hideLogs') : t('topPicksAdmin.posterRepair.showLogs')}
                </Button>
              )}
            </Box>

            {repairProgress && (
              <>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {t('topPicksAdmin.posterRepair.processed', {
                      completed: repairProgress.completed,
                      total: repairProgress.total,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {repairProgress.total > 0
                      ? t('topPicksAdmin.posterRepair.percent', {
                          value: Math.round((repairProgress.completed / repairProgress.total) * 100),
                        })
                      : t('topPicksAdmin.posterRepair.percentZero')}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={repairProgress.total > 0 
                    ? (repairProgress.completed / repairProgress.total) * 100 
                    : 0}
                  sx={{ height: 6, borderRadius: 1, mb: 1 }}
                />
                {!repairing && (
                  <Box display="flex" gap={2}>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label={t('topPicksAdmin.posterRepair.successful', { count: repairProgress.successful })}
                      color="success"
                      variant="outlined"
                    />
                    {repairProgress.failed > 0 && (
                      <Chip
                        size="small"
                        icon={<ErrorIcon />}
                        label={t('topPicksAdmin.posterRepair.failed', { count: repairProgress.failed })}
                        color="error"
                        variant="outlined"
                      />
                    )}
                  </Box>
                )}
              </>
            )}

            {/* Live logs */}
            <Collapse in={showLogs && jobLogs.length > 0}>
              <Paper
                variant="outlined"
                sx={{
                  mt: 1,
                  p: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: '#0d1117',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              >
                {jobLogs.map((log, i) => (
                  <Box
                    key={i}
                    sx={{
                      color: log.level === 'error' ? '#f85149' : log.level === 'warn' ? '#d29922' : '#8b949e',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {log.message}
                  </Box>
                ))}
                <div ref={logsEndRef} />
              </Paper>
            </Collapse>

            {/* Failed results (legacy - for sync API) */}
            {repairResults.filter((r) => !r.success).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="error" fontWeight={600}>
                  {t('topPicksAdmin.posterRepair.failedItems')}
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
                {t('topPicksAdmin.posterRepair.scanResults')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {scannedAt &&
                  t('topPicksAdmin.posterRepair.scannedAt', {
                    time: new Date(scannedAt).toLocaleTimeString(),
                  })}
              </Typography>
            </Box>

            <Box display="flex" gap={3} flexWrap="wrap">
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <MovieIcon fontSize="small" color="action" />
                  <Typography variant="body2" component="span">
                    <Trans
                      i18nKey="topPicksAdmin.posterRepair.moviesMissing"
                      values={{ count: scanSummary.moviesWithMissingPosters }}
                      components={{ 0: <strong /> }}
                    />
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('topPicksAdmin.posterRepair.moviesRepairable', { count: scanSummary.moviesRepairable })}
                </Typography>
              </Box>
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TvIcon fontSize="small" color="action" />
                  <Typography variant="body2" component="span">
                    <Trans
                      i18nKey="topPicksAdmin.posterRepair.seriesMissing"
                      values={{ count: scanSummary.seriesWithMissingPosters }}
                      components={{ 0: <strong /> }}
                    />
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('topPicksAdmin.posterRepair.seriesRepairable', { count: scanSummary.seriesRepairable })}
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
                label={t('topPicksAdmin.posterRepair.tabMovies', { count: movies.length })}
                sx={{ textTransform: 'none' }}
              />
              <Tab
                icon={<TvIcon />}
                iconPosition="start"
                label={t('topPicksAdmin.posterRepair.tabSeries', { count: series.length })}
                sx={{ textTransform: 'none' }}
              />
            </Tabs>

            {/* Movies Tab */}
            {tabValue === 0 && (
              <Box>
                {movies.length === 0 ? (
                  <Alert severity="success">{t('topPicksAdmin.posterRepair.noMoviesMissing')}</Alert>
                ) : (
                  <>
                    <Box display="flex" gap={1} mb={2}>
                      <Button size="small" variant="outlined" onClick={selectAllMovies}>
                        {t('topPicksAdmin.posterRepair.selectAllRepairable')}
                      </Button>
                      <Button size="small" variant="outlined" onClick={deselectAllMovies}>
                        {t('topPicksAdmin.posterRepair.deselectAll')}
                      </Button>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                        {t('topPicksAdmin.posterRepair.selectedCount', { count: selectedMovies.size })}
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
                            <TableCell>{t('topPicksAdmin.posterRepair.headerTitle')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerYear')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerTmdbId')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerStatus')}</TableCell>
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
                              <TableCell>{movie.year ?? t('topPicksAdmin.emDash')}</TableCell>
                              <TableCell>
                                {movie.tmdbId ? (
                                  <Chip
                                    size="small"
                                    label={movie.tmdbId}
                                    variant="outlined"
                                    sx={{ height: 20 }}
                                  />
                                ) : (
                                  <Tooltip title={t('topPicksAdmin.posterRepair.tooltipNoTmdb')}>
                                    <Chip
                                      size="small"
                                      label={t('topPicksAdmin.posterRepair.missingId')}
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
                                    label={t('topPicksAdmin.posterRepair.repairable')}
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<ErrorIcon />}
                                    label={t('topPicksAdmin.posterRepair.notRepairable')}
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
                  <Alert severity="success">{t('topPicksAdmin.posterRepair.noSeriesMissing')}</Alert>
                ) : (
                  <>
                    <Box display="flex" gap={1} mb={2}>
                      <Button size="small" variant="outlined" onClick={selectAllSeries}>
                        {t('topPicksAdmin.posterRepair.selectAllRepairable')}
                      </Button>
                      <Button size="small" variant="outlined" onClick={deselectAllSeries}>
                        {t('topPicksAdmin.posterRepair.deselectAll')}
                      </Button>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                        {t('topPicksAdmin.posterRepair.selectedCount', { count: selectedSeries.size })}
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
                            <TableCell>{t('topPicksAdmin.posterRepair.headerTitle')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerYear')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerTmdbId')}</TableCell>
                            <TableCell>{t('topPicksAdmin.posterRepair.headerStatus')}</TableCell>
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
                              <TableCell>{show.year ?? t('topPicksAdmin.emDash')}</TableCell>
                              <TableCell>
                                {show.tmdbId ? (
                                  <Chip
                                    size="small"
                                    label={show.tmdbId}
                                    variant="outlined"
                                    sx={{ height: 20 }}
                                  />
                                ) : (
                                  <Tooltip title={t('topPicksAdmin.posterRepair.tooltipNoTmdb')}>
                                    <Chip
                                      size="small"
                                      label={t('topPicksAdmin.posterRepair.missingId')}
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
                                    label={t('topPicksAdmin.posterRepair.repairable')}
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 22 }}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<ErrorIcon />}
                                    label={t('topPicksAdmin.posterRepair.notRepairable')}
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
                  {t('topPicksAdmin.posterRepair.bottomSelection', {
                    selected: totalSelected,
                    total: totalRepairable,
                  })}
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={repairing ? <CircularProgress size={20} color="inherit" /> : <BuildIcon />}
                  onClick={handleRepair}
                  disabled={scanning || repairing || totalSelected === 0}
                >
                  {repairing
                    ? t('topPicksAdmin.posterRepair.repairing', {
                        completed: repairProgress?.completed || 0,
                        total: repairProgress?.total || 0,
                      })
                    : t('topPicksAdmin.posterRepair.repairSelected', { count: totalSelected })}
                </Button>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

