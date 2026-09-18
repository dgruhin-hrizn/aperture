import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useBackupJobProgress,
  type JobFinishedReason,
  type JobProgress,
} from '../hooks/useBackupJobProgress'
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
  Checkbox,
  FormControlLabel,
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

/** Must match server / restore API expectation */
const RESTORE_CONFIRM_WORD = 'RESTORE'

/** Render elapsed milliseconds as m:ss (or h:mm:ss past an hour). */
function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

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

export function BackupSection() {
  const { t } = useTranslation()
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

  // Job progress tracking (polling + restore token live in the hook)
  const [showLogs, setShowLogs] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const fetchDataRef = useRef<() => Promise<void>>(async () => {})
  
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
  const [skipPreRestoreBackup, setSkipPreRestoreBackup] = useState(false)
  const [restoreCompleted, setRestoreCompleted] = useState(false)

  const handleJobFinished = useCallback(
    (reason: JobFinishedReason, progress: JobProgress) => {
      setCreatingBackup(false)
      setRestoringBackup(false)
      setInProgressBackup(null)

      if (reason === 'failed') {
        setError(progress.error || t('settingsBackup.operationFailed'))
        return
      }
      if (reason === 'cancelled') return

      const seconds = Math.round(((progress.result?.duration as number) || 0) / 1000)

      if (progress.jobName === 'restore-database') {
        // The restore replaced the sessions table, so this session no longer
        // exists. Point the user at the login screen instead of leaving them on
        // a page whose every subsequent request will 401.
        setRestoreCompleted(true)
        setSuccess(t('settingsBackup.restoreCompleteRelogin', { seconds }))
        return
      }

      setSuccess(t('settingsBackup.backupCompleteIn', { seconds }))
      void fetchDataRef.current()
    },
    [t]
  )

  const handleAuthLost = useCallback(() => {
    setCreatingBackup(false)
    setRestoringBackup(false)
    setInProgressBackup(null)
    setError(t('settingsBackup.sessionExpired'))
  }, [t])

  const { activeJobId, jobProgress, elapsedMs, trackJob, stopTracking } = useBackupJobProgress({
    onFinished: handleJobFinished,
    onAuthLost: handleAuthLost,
  })

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
          // No token available when resuming after a reload; session auth is fine here.
          trackJob(backupJob.currentJobId)
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
  }, [activeJobId, trackJob])

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

      // Start polling for progress
      if (data.jobId) {
        trackJob(data.jobId)
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
        stopTracking()
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

      setSuccess(t('settingsBackup.uploadSuccess', { filename: data.filename, size: data.sizeFormatted }))
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
    if (!restoreFilename || restoreConfirmText !== RESTORE_CONFIRM_WORD) return

    try {
      setRestoringBackup(true)
      setError(null)
      setSuccess(null)
      setRestoreDialogOpen(false)
      setShowLogs(true)

      // Start restore in async mode (returns job ID immediately)
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: restoreFilename,
          confirmText: RESTORE_CONFIRM_WORD,
          createPreRestoreBackup: !skipPreRestoreBackup,
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

      // Start polling. The progress token keeps this working after the restore
      // drops the sessions table and this session stops being valid.
      if (data.jobId) {
        trackJob(data.jobId, data.progressToken)
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

      setSuccess(t('settingsBackup.configSaved'))
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

  const backupDetailLabel =
    (inProgressBackup
      ? backups.filter((b) => b.filename !== inProgressBackup.filename).length
      : backups.length) + (inProgressBackup ? t('settingsBackup.availableBackupsInProgressSuffix') : '')

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
            <Typography variant="h6">{t('settingsBackup.title')}</Typography>
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

          {/* A restore replaces the sessions table, so this session is gone. Give the
              user an explicit way back in rather than letting every request 401. */}
          {restoreCompleted && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => { window.location.href = '/login' }}>
                  {t('settingsBackup.goToLogin')}
                </Button>
              }
            >
              {t('settingsBackup.restoreCompleteSignedOut')}
            </Alert>
          )}

          {/* Configuration Section */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <SettingsIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('settingsBackup.configuration')}
                </Typography>
              </Box>
              {!editingConfig && (
                <Button size="small" onClick={() => setEditingConfig(true)}>
                  {t('settingsBackup.edit')}
                </Button>
              )}
            </Box>

            {editingConfig ? (
              <Stack spacing={2}>
                <TextField
                  label={t('settingsBackup.backupsToRetain')}
                  type="number"
                  size="small"
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 100 }}
                  helperText={t('settingsBackup.backupsToRetainHelper')}
                />
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? <CircularProgress size={16} /> : t('common.save')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditingConfig(false)
                      setRetentionCount(config?.retentionCount ?? 7)
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t('settingsBackup.backupPath')}
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {config?.backupPath}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t('settingsBackup.retentionCount')}
                  </Typography>
                  <Typography variant="body2">
                    {t('settingsBackup.retentionCountValue', { count: config?.retentionCount ?? 0 })}
                  </Typography>
                </Box>
                {config?.lastBackupAt && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t('settingsBackup.lastBackup')}
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
              {creatingBackup ? t('settingsBackup.backingUp') : t('settingsBackup.backupNow')}
            </Button>

            {creatingBackup && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={handleCancelBackup}
              >
                {t('settingsBackup.cancel')}
              </Button>
            )}

            <Button
              variant="outlined"
              component="label"
              startIcon={uploadingBackup ? <CircularProgress size={16} /> : <UploadIcon />}
              disabled={uploadingBackup || restoringBackup || creatingBackup}
            >
              {uploadingBackup ? t('settingsBackup.uploading') : t('settingsBackup.uploadBackup')}
              <input type="file" hidden accept=".sql,.sql.gz,.dump" onChange={handleUploadBackup} />
            </Button>

            <Box display="flex" alignItems="center" gap={0.5} ml="auto">
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {t('settingsBackup.scheduleNote')}
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
                    {jobProgress?.jobName === 'backup-database'
                      ? t('settingsBackup.jobCreatingBackup')
                      : t('settingsBackup.jobRestoring')}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setShowLogs(!showLogs)}
                >
                  {showLogs ? t('settingsBackup.hideLogs') : t('settingsBackup.showLogs')}
                </Button>
              </Box>

              {/* Progress bar */}
              <Box sx={{ mb: 1 }}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {jobProgress?.currentStep || t('settingsBackup.initializing')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatElapsed(elapsedMs)} · {jobProgress?.overallProgress || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={jobProgress?.overallProgress || 0}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>

              {/* A restore has no percentage to report from pg_restore and can run for
                  a long time on large databases. Say so, so nobody assumes it stalled. */}
              {restoringBackup && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  {t('settingsBackup.restoreInProgressNotice')}
                </Alert>
              )}

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
            {t('settingsBackup.availableBackups', { detail: backupDetailLabel })}
          </Typography>

          {backups.length === 0 && !inProgressBackup ? (
            <Alert severity="info">{t('settingsBackup.noBackups')}</Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>{t('settingsBackup.colStatus')}</TableCell>
                    <TableCell>{t('settingsBackup.colFilename')}</TableCell>
                    <TableCell>{t('settingsBackup.colSize')}</TableCell>
                    <TableCell>{t('settingsBackup.colCreated')}</TableCell>
                    <TableCell align="right">{t('settingsBackup.colActions')}</TableCell>
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
                        <Tooltip title={t('settingsBackup.tooltipBackupProgress')}>
                          <CircularProgress size={18} color="primary" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                            {inProgressBackup.filename}
                          </Typography>
                          <Chip
                            label={t('settingsBackup.chipInProgress')}
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
                          {t('settingsBackup.now')}
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
                        <Tooltip title={t('settingsBackup.tooltipBackupComplete')}>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                            {backup.filename}
                          </Typography>
                          {backup.isCompressed && (
                            <Chip label={t('settingsBackup.chipGzip')} size="small" variant="outlined" sx={{ height: 20 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{backup.sizeFormatted}</TableCell>
                      <TableCell>{formatDate(backup.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('settingsBackup.tooltipRestore')}>
                          <IconButton
                            size="small"
                            onClick={() => openRestoreDialog(backup.filename)}
                            disabled={restoringBackup || creatingBackup}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('settingsBackup.tooltipDownload')}>
                          <IconButton size="small" onClick={() => handleDownloadBackup(backup.filename)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('settingsBackup.tooltipDelete')}>
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
            {t('settingsBackup.restoreDialogTitle')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{t('settingsBackup.restoreWarningTitle')}</strong> {t('settingsBackup.restoreWarningBody')}
          </Alert>
          <Typography variant="body2" mb={2}>
            {t('settingsBackup.restoreFrom', { filename: restoreFilename ?? '' })}
          </Typography>
          <Typography variant="body2" mb={2}>
            {t('settingsBackup.restoreConfirmPrompt', { word: RESTORE_CONFIRM_WORD })}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={restoreConfirmText}
            onChange={(e) => setRestoreConfirmText(e.target.value)}
            placeholder={t('settingsBackup.restorePlaceholder')}
            autoFocus
          />
          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Checkbox
                checked={skipPreRestoreBackup}
                onChange={(e) => setSkipPreRestoreBackup(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{t('settingsBackup.skipPreRestoreBackup')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('settingsBackup.skipPreRestoreBackupHelp')}
                </Typography>
              </Box>
            }
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('settingsBackup.restoreSignsYouOut')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRestore}
            disabled={restoreConfirmText !== RESTORE_CONFIRM_WORD || restoringBackup}
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
            {restoringBackup ? t('settingsBackup.restoring') : t('settingsBackup.restoreButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

