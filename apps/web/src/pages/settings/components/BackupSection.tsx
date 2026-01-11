import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Divider,
  Stack,
  LinearProgress,
  Collapse,
  Paper,
} from '@mui/material'
import BackupIcon from '@mui/icons-material/Backup'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CancelIcon from '@mui/icons-material/Cancel'

interface BackupInfo {
  filename: string
  sizeBytes: number
  sizeFormatted: string
  createdAt: string
  isCompressed: boolean
}

interface BackupConfig {
  backupPath: string
  retentionCount: number
  lastBackupAt: string | null
  lastBackupFilename: string | null
  lastBackupSizeFormatted: string | null
}

interface JobProgress {
  jobId: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: string
  currentStepIndex: number
  totalSteps: number
  overallProgress: number
  itemsProcessed: number
  itemsTotal: number
  logs: Array<{ timestamp: string; level: string; message: string }>
  error?: string
  result?: Record<string, unknown>
}

export function BackupSection() {
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Backup operation states
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null)
  const [uploadingBackup, setUploadingBackup] = useState(false)

  // Job progress tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const pollIntervalRef = useRef<number | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  
  // In-progress backup tracking
  const [inProgressBackup, setInProgressBackup] = useState<{ filename: string; sizeFormatted: string } | null>(null)
  const backupSizePollRef = useRef<number | null>(null)

  // Config editing
  const [editingConfig, setEditingConfig] = useState(false)
  const [retentionCount, setRetentionCount] = useState(7)
  const [savingConfig, setSavingConfig] = useState(false)

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoreFilename, setRestoreFilename] = useState<string | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [configRes, backupsRes, jobsRes] = await Promise.all([
        fetch('/api/backup/config', { credentials: 'include' }),
        fetch('/api/backup/list', { credentials: 'include' }),
        fetch('/api/jobs', { credentials: 'include' }),
      ])

      if (!configRes.ok) {
        throw new Error('Failed to load backup configuration')
      }
      if (!backupsRes.ok) {
        throw new Error('Failed to load backups list')
      }

      const configData = await configRes.json()
      const backupsData = await backupsRes.json()

      setConfig(configData)
      setBackups(backupsData.backups || [])
      setRetentionCount(configData.retentionCount)

      // Check for running backup/restore jobs and resume tracking
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        const backupJob = jobsData.jobs?.find(
          (j: { name: string; currentJobId?: string }) =>
            (j.name === 'backup-database' || j.name === 'restore-database') && j.currentJobId
        )
        if (backupJob?.currentJobId && !activeJobId) {
          setActiveJobId(backupJob.currentJobId)
          if (backupJob.name === 'backup-database') {
            setCreatingBackup(true)
          } else {
            setRestoringBackup(true)
          }
          setShowLogs(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backup data')
    } finally {
      setLoading(false)
    }
  }, [activeJobId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll for job progress
  const pollJobProgress = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/progress/${jobId}`, { credentials: 'include' })
      
      // Check content type before parsing
      const contentType = res.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        // Got HTML or other non-JSON response - likely auth or proxy error
        console.warn('Job progress returned non-JSON response:', contentType)
        if (res.status === 401 || res.status === 403) {
          setError('Session expired. Please refresh and try again.')
        }
        setActiveJobId(null)
        setCreatingBackup(false)
        setRestoringBackup(false)
        setInProgressBackup(null)
        return
      }
      
      if (!res.ok) {
        // Job might have finished and been cleaned up
        if (res.status === 404) {
          setActiveJobId(null)
          setCreatingBackup(false)
          setRestoringBackup(false)
          setInProgressBackup(null)
          return
        }
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to get job progress')
      }
      const data = await res.json()
      setJobProgress(data)

      // Extract filename from logs for in-progress backup display
      if (data.jobName === 'backup-database' && data.status === 'running') {
        // Look for filename in logs (format: "📦 Running pg_dump to aperture_backup_xxx.sql.gz...")
        const filenameLog = data.logs?.find((log: { message: string }) => 
          log.message.includes('Running pg_dump to ')
        )
        if (filenameLog) {
          const match = filenameLog.message.match(/Running pg_dump to ([^\s.]+\.sql\.gz)/)
          if (match) {
            setInProgressBackup({ filename: match[1], sizeFormatted: 'Writing...' })
          }
        }
      }

      // Auto-scroll logs (within container only, not the page)
      if (logsEndRef.current?.parentElement && showLogs) {
        const container = logsEndRef.current.parentElement
        container.scrollTop = container.scrollHeight
      }

      // Check if job is complete
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        setActiveJobId(null)
        setCreatingBackup(false)
        setRestoringBackup(false)
        setInProgressBackup(null)

        if (data.status === 'completed') {
          const result = data.result || {}
          if (data.jobName === 'backup-database') {
            setSuccess(`Backup created successfully: ${result.filename || 'backup'} (${Math.round((data.result?.duration || 0) / 1000)}s)`)
          } else if (data.jobName === 'restore-database') {
            setSuccess(`Database restored successfully (${Math.round((data.result?.duration || 0) / 1000)}s)`)
          }
          await fetchData()
        } else if (data.status === 'failed') {
          setError(data.error || 'Operation failed')
        }

        // Clear job progress after a delay
        setTimeout(() => {
          setJobProgress(null)
          setShowLogs(false)
        }, 5000)
      }
    } catch (err) {
      console.error('Failed to poll job progress:', err)
    }
  }, [fetchData])

  // Set up polling when job is active
  useEffect(() => {
    if (activeJobId) {
      // Poll immediately
      pollJobProgress(activeJobId)

      // Set up interval
      pollIntervalRef.current = window.setInterval(() => {
        pollJobProgress(activeJobId)
      }, 1000)

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
  }, [activeJobId, pollJobProgress])

  // Poll for in-progress backup file size
  useEffect(() => {
    if (inProgressBackup?.filename && creatingBackup) {
      const pollSize = async () => {
        try {
          const res = await fetch('/api/backup/list', { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            const currentBackup = data.backups?.find(
              (b: BackupInfo) => b.filename === inProgressBackup.filename
            )
            if (currentBackup) {
              setInProgressBackup(prev => 
                prev ? { ...prev, sizeFormatted: currentBackup.sizeFormatted } : null
              )
            }
          }
        } catch {
          // Ignore errors during size polling
        }
      }

      // Poll for size every 2 seconds
      backupSizePollRef.current = window.setInterval(pollSize, 2000)
      pollSize() // Poll immediately

      return () => {
        if (backupSizePollRef.current) {
          clearInterval(backupSizePollRef.current)
          backupSizePollRef.current = null
        }
      }
    }
  }, [inProgressBackup?.filename, creatingBackup])

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true)
      setError(null)
      setSuccess(null)
      setJobProgress(null)
      setShowLogs(true)

      // Start backup in async mode (returns job ID immediately)
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        credentials: 'include',
      })

      // Check content type before parsing JSON
      const contentType = res.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await res.text()
        console.error('Backup create returned non-JSON:', text.substring(0, 200))
        throw new Error('Server returned invalid response. Check server logs.')
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup')
      }

      // Set active job ID to start polling
      if (data.jobId) {
        setActiveJobId(data.jobId)
      } else {
        // Sync mode fallback
        setSuccess(`Backup created: ${data.filename} (${data.sizeFormatted})`)
        setCreatingBackup(false)
        await fetchData()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup')
      setCreatingBackup(false)
    }
  }

  const handleCancelBackup = async () => {
    if (!activeJobId) return

    try {
      const res = await fetch(`/api/backup/cancel/${activeJobId}`, {
        method: 'POST',
        credentials: 'include',
      })

      if (res.ok) {
        setSuccess('Backup cancelled')
        setCreatingBackup(false)
        setActiveJobId(null)
        setJobProgress(null)
        setInProgressBackup(null)
        await fetchData()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to cancel backup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel backup')
    }
  }

  const handleDeleteBackup = async (filename: string) => {
    try {
      setDeletingBackup(filename)
      setError(null)

      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete backup')
      }

      setSuccess(`Backup deleted: ${filename}`)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup')
    } finally {
      setDeletingBackup(null)
    }
  }

  const handleDownloadBackup = (filename: string) => {
    window.open(`/api/backup/download/${encodeURIComponent(filename)}`, '_blank')
  }

  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingBackup(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/backup/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload backup')
      }

      setSuccess(`Backup uploaded: ${data.filename} (${data.sizeFormatted})`)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload backup')
    } finally {
      setUploadingBackup(false)
      // Reset the input
      event.target.value = ''
    }
  }

  const openRestoreDialog = (filename: string) => {
    setRestoreFilename(filename)
    setRestoreConfirmText('')
    setRestoreDialogOpen(true)
  }

  const handleRestore = async () => {
    if (!restoreFilename || restoreConfirmText !== 'RESTORE') return

    try {
      setRestoringBackup(true)
      setError(null)
      setSuccess(null)
      setRestoreDialogOpen(false)
      setJobProgress(null)
      setShowLogs(true)

      // Start restore in async mode (returns job ID immediately)
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: restoreFilename,
          confirmText: 'RESTORE',
          createPreRestoreBackup: true,
        }),
      })

      // Check content type before parsing JSON
      const contentType = res.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await res.text()
        console.error('Restore returned non-JSON:', text.substring(0, 200))
        throw new Error('Server returned invalid response. Check server logs.')
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup')
      }

      // Set active job ID to start polling
      if (data.jobId) {
        setActiveJobId(data.jobId)
      } else {
        // Sync mode fallback
        setSuccess(
          `Database restored successfully from ${restoreFilename}. ` +
            (data.preRestoreBackup
              ? `Pre-restore backup created: ${data.preRestoreBackup}`
              : 'You may need to refresh the page.')
        )
        setRestoringBackup(false)
        await fetchData()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup')
      setRestoringBackup(false)
    } finally {
      setRestoreFilename(null)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true)
      setError(null)

      const res = await fetch('/api/backup/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionCount }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccess('Backup configuration saved')
      setEditingConfig(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <BackupIcon color="primary" />
            <Typography variant="h6">Database Backup & Restore</Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Configuration Section */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <SettingsIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Configuration
                </Typography>
              </Box>
              {!editingConfig && (
                <Button size="small" onClick={() => setEditingConfig(true)}>
                  Edit
                </Button>
              )}
            </Box>

            {editingConfig ? (
              <Stack spacing={2}>
                <TextField
                  label="Backups to Retain"
                  type="number"
                  size="small"
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 100 }}
                  helperText="Number of backup files to keep (older backups are automatically deleted)"
                />
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? <CircularProgress size={16} /> : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditingConfig(false)
                      setRetentionCount(config?.retentionCount ?? 7)
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Backup Path
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {config?.backupPath}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Retention Count
                  </Typography>
                  <Typography variant="body2">{config?.retentionCount} backups</Typography>
                </Box>
                {config?.lastBackupAt && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Last Backup
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <CheckCircleIcon fontSize="small" color="success" />
                      <Typography variant="body2">
                        {formatDate(config.lastBackupAt)}
                        {config.lastBackupSizeFormatted && ` (${config.lastBackupSizeFormatted})`}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Box display="flex" alignItems="center" gap={2} mb={3} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={
                creatingBackup ? (
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                      size={20}
                      color="inherit"
                      variant={jobProgress?.overallProgress ? 'determinate' : 'indeterminate'}
                      value={jobProgress?.overallProgress || 0}
                    />
                    {jobProgress?.overallProgress !== undefined && (
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'inherit' }}
                        >
                          {Math.round(jobProgress.overallProgress)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <BackupIcon />
                )
              }
              onClick={handleCreateBackup}
              disabled={creatingBackup || restoringBackup}
            >
              {creatingBackup ? 'Backing up...' : 'Backup Now'}
            </Button>

            {creatingBackup && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={handleCancelBackup}
              >
                Cancel
              </Button>
            )}

            <Button
              variant="outlined"
              component="label"
              startIcon={uploadingBackup ? <CircularProgress size={16} /> : <UploadIcon />}
              disabled={uploadingBackup || restoringBackup || creatingBackup}
            >
              {uploadingBackup ? 'Uploading...' : 'Upload Backup'}
              <input type="file" hidden accept=".sql,.sql.gz,.dump" onChange={handleUploadBackup} />
            </Button>

            <Box display="flex" alignItems="center" gap={0.5} ml="auto">
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Automatic backups run daily at 2:00 AM
              </Typography>
            </Box>
          </Box>

          {/* Job Progress Section */}
          <Collapse in={!!jobProgress}>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  {jobProgress?.status === 'running' && <CircularProgress size={16} />}
                  {jobProgress?.status === 'completed' && <CheckCircleIcon color="success" fontSize="small" />}
                  {jobProgress?.status === 'failed' && <ErrorIcon color="error" fontSize="small" />}
                  <Typography variant="subtitle2" fontWeight={600}>
                    {jobProgress?.jobName === 'backup-database' ? 'Creating Backup' : 'Restoring Database'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setShowLogs(!showLogs)}
                >
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </Button>
              </Box>

              {/* Progress bar */}
              <Box sx={{ mb: 1 }}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {jobProgress?.currentStep || 'Initializing...'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {jobProgress?.overallProgress || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={jobProgress?.overallProgress || 0}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>

              {/* Logs */}
              <Collapse in={showLogs}>
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
                  {jobProgress?.logs?.map((log, i) => (
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
            </Box>
          </Collapse>

          {/* Backups List */}
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Available Backups ({inProgressBackup ? backups.filter(b => b.filename !== inProgressBackup.filename).length : backups.length}{inProgressBackup ? ' + 1 in progress' : ''})
          </Typography>

          {backups.length === 0 && !inProgressBackup ? (
            <Alert severity="info">No backups found. Create your first backup using the button above.</Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>Status</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* In-progress backup row */}
                  {inProgressBackup && (
                    <TableRow 
                      sx={{ 
                        bgcolor: 'action.hover',
                        '& td': { borderBottom: '2px solid', borderColor: 'primary.main' }
                      }}
                    >
                      <TableCell>
                        <Tooltip title="Backup in progress">
                          <CircularProgress size={18} color="primary" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                            {inProgressBackup.filename}
                          </Typography>
                          <Chip 
                            label="In Progress" 
                            size="small" 
                            color="primary" 
                            sx={{ height: 20, fontSize: '0.7rem' }} 
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary.main" fontWeight={500}>
                          {inProgressBackup.sizeFormatted}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          Now
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Completed backups (excluding in-progress) */}
                  {backups
                    .filter((backup) => !inProgressBackup || backup.filename !== inProgressBackup.filename)
                    .map((backup) => (
                    <TableRow key={backup.filename} hover>
                      <TableCell>
                        <Tooltip title="Backup complete">
                          <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                            {backup.filename}
                          </Typography>
                          {backup.isCompressed && (
                            <Chip label="gzip" size="small" variant="outlined" sx={{ height: 20 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{backup.sizeFormatted}</TableCell>
                      <TableCell>{formatDate(backup.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Restore">
                          <IconButton
                            size="small"
                            onClick={() => openRestoreDialog(backup.filename)}
                            disabled={restoringBackup || creatingBackup}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => handleDownloadBackup(backup.filename)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteBackup(backup.filename)}
                            disabled={deletingBackup === backup.filename}
                          >
                            {deletingBackup === backup.filename ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'warning.main' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <RestoreIcon />
            Restore Database
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Warning:</strong> This will replace all current data with the backup. A pre-restore backup
            will be created automatically.
          </Alert>
          <Typography variant="body2" mb={2}>
            You are about to restore from: <strong>{restoreFilename}</strong>
          </Typography>
          <Typography variant="body2" mb={2}>
            To confirm, type <strong>RESTORE</strong> below:
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={restoreConfirmText}
            onChange={(e) => setRestoreConfirmText(e.target.value)}
            placeholder="Type RESTORE to confirm"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRestore}
            disabled={restoreConfirmText !== 'RESTORE' || restoringBackup}
            startIcon={
              restoringBackup ? (
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress
                    size={20}
                    color="inherit"
                    variant={jobProgress?.overallProgress ? 'determinate' : 'indeterminate'}
                    value={jobProgress?.overallProgress || 0}
                  />
                  {jobProgress?.overallProgress !== undefined && (
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="span"
                        sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'inherit' }}
                      >
                        {Math.round(jobProgress.overallProgress)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <RestoreIcon />
              )
            }
          >
            {restoringBackup ? 'Restoring...' : 'Restore Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

