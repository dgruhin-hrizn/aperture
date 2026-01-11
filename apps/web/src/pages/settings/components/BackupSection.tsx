import { useState, useEffect, useCallback } from 'react'
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
} from '@mui/material'
import BackupIcon from '@mui/icons-material/Backup'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

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

      const [configRes, backupsRes] = await Promise.all([
        fetch('/api/backup/config', { credentials: 'include' }),
        fetch('/api/backup/list', { credentials: 'include' }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backup data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/backup/create', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup')
      }

      setSuccess(`Backup created: ${data.filename} (${data.sizeFormatted})`)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup')
    } finally {
      setCreatingBackup(false)
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
      setRestoreDialogOpen(false)

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

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup')
      }

      setSuccess(
        `Database restored successfully from ${restoreFilename}. ` +
          (data.preRestoreBackup
            ? `Pre-restore backup created: ${data.preRestoreBackup}`
            : 'You may need to refresh the page.')
      )
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup')
    } finally {
      setRestoringBackup(false)
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
              startIcon={creatingBackup ? <CircularProgress size={16} color="inherit" /> : <BackupIcon />}
              onClick={handleCreateBackup}
              disabled={creatingBackup || restoringBackup}
            >
              {creatingBackup ? 'Creating Backup...' : 'Backup Now'}
            </Button>

            <Button
              variant="outlined"
              component="label"
              startIcon={uploadingBackup ? <CircularProgress size={16} /> : <UploadIcon />}
              disabled={uploadingBackup || restoringBackup}
            >
              {uploadingBackup ? 'Uploading...' : 'Upload Backup'}
              <input type="file" hidden accept=".sql,.sql.gz" onChange={handleUploadBackup} />
            </Button>

            <Box display="flex" alignItems="center" gap={0.5} ml="auto">
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Automatic backups run daily at 2:00 AM
              </Typography>
            </Box>
          </Box>

          {/* Backups List */}
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Available Backups ({backups.length})
          </Typography>

          {backups.length === 0 ? (
            <Alert severity="info">No backups found. Create your first backup using the button above.</Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Filename</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.filename} hover>
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
            startIcon={restoringBackup ? <CircularProgress size={16} color="inherit" /> : <RestoreIcon />}
          >
            {restoringBackup ? 'Restoring...' : 'Restore Database'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

