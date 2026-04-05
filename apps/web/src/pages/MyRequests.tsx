import React, { useCallback, useEffect, useState } from 'react'
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
} from '@mui/material'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

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
}

function statusLabel(row: DiscoveryRequestRow): string {
  const live = row.seerrLive
  if (live) {
    if (live.mediaStatus === 'available') return 'Available'
    if (live.status === 'declined') return 'Declined'
    if (live.status === 'pending') return 'Pending approval'
    if (live.mediaStatus === 'processing' || live.mediaStatus === 'partially_available') {
      return 'Processing'
    }
    if (live.status === 'approved') return 'Approved'
  }
  const s = row.status
  if (s === 'submitted') return 'Submitted'
  if (s === 'pending') return 'Pending'
  if (s === 'approved') return 'Approved'
  if (s === 'declined') return 'Declined'
  if (s === 'available') return 'Available'
  if (s === 'failed') return 'Failed'
  return s
}

function statusColor(row: DiscoveryRequestRow): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const label = statusLabel(row)
  if (label === 'Available') return 'success'
  if (label === 'Declined' || row.status === 'failed') return 'error'
  if (label === 'Failed') return 'error'
  if (label === 'Pending approval' || label === 'Pending' || label === 'Submitted') return 'warning'
  if (label === 'Approved' || label === 'Processing') return 'info'
  return 'default'
}

type SourceFilter = 'all' | 'discovery' | 'gap_analysis'

export function MyRequestsPage() {
  const [rows, setRows] = useState<DiscoveryRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = new URL('/api/seerr/requests', window.location.origin)
      if (sourceFilter !== 'all') u.searchParams.set('source', sourceFilter)
      const res = await fetch(u.toString(), { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Could not load requests')
      }
      const data = await res.json()
      setRows(data.requests || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load requests')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter])

  useEffect(() => {
    void load()
  }, [load])

  const tmdbUrl = (r: DiscoveryRequestRow) =>
    r.mediaType === 'movie'
      ? `https://www.themoviedb.org/movie/${r.tmdbId}`
      : `https://www.themoviedb.org/tv/${r.tmdbId}`

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <PlaylistAddCheckIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>
          My Requests
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Content you requested through Discovery or Gap Analysis (admin). Status is synced from Seerr when
        available.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3} alignItems={{ sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="req-source-filter">Source</InputLabel>
          <Select
            labelId="req-source-filter"
            label="Source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="discovery">Discovery</MenuItem>
            <MenuItem value="gap_analysis">Gap Analysis</MenuItem>
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
        ) : rows.length === 0 ? (
          <Box py={6} px={2} textAlign="center">
            <Typography color="text.secondary">
              No requests yet. When you request titles from Discovery, they will appear here.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell width={100}>Type</TableCell>
                  <TableCell width={130}>Source</TableCell>
                  <TableCell width={140}>Requested</TableCell>
                  <TableCell width={180}>Status</TableCell>
                  <TableCell width={160} align="right">
                    Actions
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
                          Seerr request #{r.seerrRequestId}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.mediaType === 'movie' ? 'Movie' : 'Series'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.source === 'gap_analysis' ? 'Gap Analysis' : 'Discovery'}
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
                            ? `Request: ${r.seerrLive.status} · media: ${r.seerrLive.mediaStatus}`
                            : ''
                        }
                      >
                        <Chip
                          size="small"
                          label={statusLabel(r)}
                          color={statusColor(r)}
                          variant={statusColor(r) === 'default' ? 'outlined' : 'filled'}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        component="a"
                        href={tmdbUrl(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                      >
                        View on TMDb
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}
