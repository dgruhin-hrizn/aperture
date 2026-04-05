import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TablePagination,
} from '@mui/material'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import {
  TmdbExternalDetailModal,
  type TmdbExternalDetailPayload,
} from '../components/TmdbExternalDetailModal'

type SeerrLive = {
  status: 'pending' | 'approved' | 'declined'
  mediaStatus: 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'
} | null

interface DiscoveryRequestRow {
  id: string
  userId: string
  mediaType: 'movie' | 'series'
  tmdbId: number
  title: string
  seerrRequestId: number | null
  seerrMediaId: number | null
  status: string
  statusMessage: string | null
  discoveryCandidateId: string | null
  source?: 'discovery' | 'gap_analysis'
  createdAt: string
  updatedAt: string
  seerrLive: SeerrLive
  libraryMediaId?: string | null
}

function getRequestStatusKey(row: DiscoveryRequestRow): string | null {
  const live = row.seerrLive
  if (live) {
    if (live.mediaStatus === 'available') return 'available'
    if (live.status === 'declined') return 'declined'
    if (live.status === 'pending') return 'pendingApproval'
    if (live.mediaStatus === 'processing' || live.mediaStatus === 'partially_available') {
      return 'processing'
    }
    if (live.status === 'approved') return 'approved'
  }
  const s = row.status
  if (s === 'submitted') return 'submitted'
  if (s === 'pending') return 'pending'
  if (s === 'approved') return 'approved'
  if (s === 'declined') return 'declined'
  if (s === 'available') return 'available'
  if (s === 'failed') return 'failed'
  return null
}

function isRowAvailable(row: DiscoveryRequestRow): boolean {
  return getRequestStatusKey(row) === 'available'
}

function statusColor(row: DiscoveryRequestRow): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const key = getRequestStatusKey(row)
  if (key === 'available') return 'success'
  if (key === 'declined' || key === 'failed' || row.status === 'failed') return 'error'
  if (key === 'pendingApproval' || key === 'pending' || key === 'submitted') return 'warning'
  if (key === 'approved' || key === 'processing') return 'info'
  return 'default'
}

type SourceFilter = 'all' | 'discovery' | 'gap_analysis'

export function MyRequestsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<DiscoveryRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [total, setTotal] = useState(0)

  const [tmdbModalOpen, setTmdbModalOpen] = useState(false)
  const [tmdbModalLoading, setTmdbModalLoading] = useState(false)
  const [tmdbModalError, setTmdbModalError] = useState<string | null>(null)
  const [tmdbModalData, setTmdbModalData] = useState<TmdbExternalDetailPayload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = new URL('/api/seerr/requests', window.location.origin)
      if (sourceFilter !== 'all') u.searchParams.set('source', sourceFilter)
      u.searchParams.set('limit', String(rowsPerPage))
      u.searchParams.set('offset', String(page * rowsPerPage))
      const res = await fetch(u.toString(), { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || t('myRequests.errorLoad'))
      }
      const data = (await res.json()) as {
        requests?: DiscoveryRequestRow[]
        total?: number
      }
      const list = data.requests || []
      setRows(list)
      setTotal(typeof data.total === 'number' ? data.total : list.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('myRequests.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, page, rowsPerPage, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (total === 0) return
    const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [total, rowsPerPage, page])

  const openTmdbModal = (r: DiscoveryRequestRow) => {
    setTmdbModalOpen(true)
    setTmdbModalLoading(true)
    setTmdbModalError(null)
    setTmdbModalData(null)
    const path = r.mediaType === 'movie' ? 'movie' : 'tv'
    void fetch(`/api/discover/tmdb/${path}/${r.tmdbId}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || t('myRequests.errorLoadDetails'))
        }
        return res.json() as Promise<TmdbExternalDetailPayload>
      })
      .then((payload) => setTmdbModalData(payload))
      .catch((e: unknown) => {
        setTmdbModalError(e instanceof Error ? e.message : t('myRequests.errorLoadDetails'))
      })
      .finally(() => setTmdbModalLoading(false))
  }

  const closeTmdbModal = () => {
    setTmdbModalOpen(false)
    setTmdbModalError(null)
    setTmdbModalData(null)
  }

  const formatRequestStatus = (row: DiscoveryRequestRow) => {
    const key = getRequestStatusKey(row)
    if (key) return t(`myRequests.requestStatus.${key}`)
    return t('myRequests.requestStatus.fallback', { status: row.status })
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <PlaylistAddCheckIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>
          {t('nav.myRequests')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {t('myRequests.pageSubtitle')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3} alignItems={{ sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="req-source-filter">{t('myRequests.source')}</InputLabel>
          <Select
            labelId="req-source-filter"
            label={t('myRequests.source')}
            value={sourceFilter}
            onChange={(e) => {
              setPage(0)
              setSourceFilter(e.target.value as SourceFilter)
            }}
          >
            <MenuItem value="all">{t('myRequests.sourceAll')}</MenuItem>
            <MenuItem value="discovery">{t('myRequests.sourceDiscovery')}</MenuItem>
            <MenuItem value="gap_analysis">{t('myRequests.sourceGapAnalysis')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : total === 0 ? (
          <Box py={6} px={2} textAlign="center">
            <Typography color="text.secondary">
              {t('myRequests.empty')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('myRequests.tableTitle')}</TableCell>
                  <TableCell width={100}>{t('myRequests.tableType')}</TableCell>
                  <TableCell width={130}>{t('myRequests.tableSource')}</TableCell>
                  <TableCell width={140}>{t('myRequests.tableRequested')}</TableCell>
                  <TableCell width={180}>{t('myRequests.tableStatus')}</TableCell>
                  <TableCell width={180} align="right">
                    {t('myRequests.tableActions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{r.title}</Typography>
                      {r.seerrRequestId != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('myRequests.seerrRequest', { id: r.seerrRequestId })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.mediaType === 'movie' ? t('myRequests.typeMovie') : t('myRequests.typeSeries')}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.source === 'gap_analysis' ? t('myRequests.sourceGapAnalysis') : t('myRequests.sourceDiscovery')}
                        variant="outlined"
                        color={r.source === 'gap_analysis' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(r.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          r.seerrLive
                            ? t('myRequests.tooltipLive', {
                                reqStatus: r.seerrLive.status,
                                mediaStatus: r.seerrLive.mediaStatus,
                              })
                            : ''
                        }
                      >
                        <Chip
                          size="small"
                          label={formatRequestStatus(r)}
                          color={statusColor(r)}
                          variant={statusColor(r) === 'default' ? 'outlined' : 'filled'}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      {isRowAvailable(r) && r.libraryMediaId ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component={RouterLink}
                          to={
                            r.mediaType === 'movie'
                              ? `/movies/${r.libraryMediaId}`
                              : `/series/${r.libraryMediaId}`
                          }
                        >
                          {t('myRequests.openInLibrary')}
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" onClick={() => openTmdbModal(r)}>
                          {t('myRequests.details')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage={t('common.rowsPerPage')}
          />
        )}
      </Paper>

      <TmdbExternalDetailModal
        open={tmdbModalOpen}
        onClose={closeTmdbModal}
        loading={tmdbModalLoading}
        error={tmdbModalError}
        data={tmdbModalData}
        sourceLabel="TMDb"
        canRequest={false}
      />
    </Box>
  )
}
