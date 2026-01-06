import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Stack,
  Tooltip,
  Paper,
  Collapse,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CancelIcon from '@mui/icons-material/Cancel'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { formatJobName } from '../constants'
import type { JobRunRecord, LogEntry } from '../types'

interface JobHistoryDialogProps {
  open: boolean
  jobName: string | null
  onClose: () => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remainingSec = sec % 60
  if (min < 60) return `${min}m ${remainingSec}s`
  const hr = Math.floor(min / 60)
  const remainingMin = min % 60
  return `${hr}h ${remainingMin}m`
}

function getStatusIcon(status: string): React.ReactElement | undefined {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon sx={{ fontSize: 16 }} />
    case 'failed':
      return <ErrorIcon sx={{ fontSize: 16 }} />
    case 'cancelled':
      return <CancelIcon sx={{ fontSize: 16 }} />
    default:
      return undefined
  }
}

function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'warning'
    default:
      return 'default'
  }
}

export function JobHistoryDialog({ open, jobName, onClose }: JobHistoryDialogProps) {
  const [history, setHistory] = useState<JobRunRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchHistory = async () => {
    if (!jobName) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobName}/history?limit=25`)
      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }
      const data = await response.json()
      setHistory(data.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && jobName) {
      fetchHistory()
    }
  }, [open, jobName])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {jobName ? formatJobName(jobName) : 'Job'} History
          </Typography>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={fetchHistory} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box py={4} textAlign="center">
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {!loading && !error && history.length === 0 && (
          <Box py={4} textAlign="center">
            <Typography color="text.secondary">
              No run history found for this job.
            </Typography>
          </Box>
        )}

        {!loading && !error && history.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40}></TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((run) => {
                  const logs = (run.metadata?.logs as LogEntry[] | undefined) || []
                  const hasLogs = logs.length > 0
                  const isExpanded = expandedRow === run.id
                  
                  return (
                    <React.Fragment key={run.id}>
                      <TableRow 
                        hover 
                        onClick={() => hasLogs && setExpandedRow(isExpanded ? null : run.id)}
                        sx={{ cursor: hasLogs ? 'pointer' : 'default' }}
                      >
                        <TableCell>
                          {hasLogs && (
                            <IconButton size="small">
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={getStatusIcon(run.status)}
                            label={run.status}
                            color={getStatusColor(run.status)}
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={formatDate(run.started_at)}>
                            <Typography variant="body2" noWrap>
                              {formatDate(run.started_at)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDuration(run.duration_ms)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {run.items_total > 0 ? (
                            <Typography variant="body2">
                              {run.items_processed.toLocaleString()} / {run.items_total.toLocaleString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {run.error_message ? (
                            <Tooltip title={run.error_message}>
                              <Typography
                                variant="body2"
                                color="error"
                                sx={{
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {run.error_message}
                              </Typography>
                            </Tooltip>
                          ) : hasLogs ? (
                            <Typography variant="body2" color="text.secondary">
                              {logs.length} log entries
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                      {hasLogs && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ py: 0, borderBottom: isExpanded ? 1 : 0, borderColor: 'divider' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  py: 2,
                                  maxHeight: 300,
                                  overflow: 'auto',
                                  bgcolor: 'background.default',
                                  borderRadius: 1,
                                  my: 1,
                                }}
                              >
                                {logs.map((log, index) => (
                                  <Box
                                    key={index}
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      px: 2,
                                      py: 0.25,
                                      color: log.level === 'error' ? 'error.main' : 
                                             log.level === 'warn' ? 'warning.main' : 
                                             'text.secondary',
                                    }}
                                  >
                                    <Typography
                                      component="span"
                                      sx={{ color: 'text.disabled', mr: 1, fontSize: 'inherit' }}
                                    >
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </Typography>
                                    {log.message}
                                  </Box>
                                ))}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  )
}

