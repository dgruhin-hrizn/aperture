import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Divider,
  Paper,
} from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import UploadIcon from '@mui/icons-material/Upload'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import HistoryIcon from '@mui/icons-material/History'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext } from '../types'

interface BackupInfo {
  filename: string
  sizeBytes: number
  sizeFormatted: string
  createdAt: string
  isCompressed: boolean
}

interface RestoreStepProps {
  wizard: SetupWizardContext
}

export function RestoreStep({ wizard }: RestoreStepProps) {
  const { t } = useTranslation()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Restore states
  const [restoring, setRestoring] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoreFilename, setRestoreFilename] = useState<string | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/setup/backup/list', { credentials: 'include' })

      if (!res.ok) {
        throw new Error(t('setup.restore.errLoad'))
      }

      const data = await res.json()
      setBackups(data.backups || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.restore.errLoadGeneric'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/setup/backup/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('setup.restore.errUpload'))
      }

      setSuccess(t('setup.restore.successUpload', { filename: data.filename, size: data.sizeFormatted }))
      await fetchBackups()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.restore.errUpload'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const openRestoreDialog = (filename: string) => {
    setRestoreFilename(filename)
    setRestoreConfirmText('')
    setRestoreDialogOpen(true)
  }

  const confirmWord = t('setup.restore.confirmWord')

  const handleRestore = async () => {
    if (!restoreFilename || restoreConfirmText !== confirmWord) return

    try {
      setRestoring(true)
      setError(null)
      setRestoreDialogOpen(false)

      const res = await fetch('/api/setup/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: restoreFilename,
          confirmText: confirmWord,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('setup.restore.errRestore'))
      }

      setSuccess(t('setup.restore.successRestored'))

      // Reload the page after a short delay to pick up the restored data
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.restore.errRestore'))
    } finally {
      setRestoring(false)
      setRestoreFilename(null)
    }
  }

  const handleSkipRestore = () => {
    wizard.goToStep('mediaServer')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={1}>
        {t('setup.restore.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t('setup.restore.subtitle')}
      </Typography>

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

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Options */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
              mb: 4,
            }}
          >
            {/* Fresh Start Option */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              onClick={handleSkipRestore}
            >
              <AddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={600} mb={1}>
                {t('setup.restore.startFreshTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {t('setup.restore.startFreshBody')}
              </Typography>
              <Button variant="contained" endIcon={<ArrowForwardIcon />}>
                {t('setup.restore.continueSetup')}
              </Button>
            </Paper>

            {/* Restore Option */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <HistoryIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={600} mb={1}>
                {t('setup.restore.restoreCardTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {t('setup.restore.restoreCardBody')}
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
                disabled={uploading || restoring}
              >
                {uploading ? t('setup.restore.uploading') : t('setup.restore.uploadBackupFile')}
                <input type="file" hidden accept=".sql,.sql.gz" onChange={handleUploadBackup} />
              </Button>
            </Paper>
          </Box>

          {/* Available Backups */}
          {backups.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                {t('setup.restore.availableBackups', { count: backups.length })}
              </Typography>

              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('setup.restore.colFilename')}</TableCell>
                      <TableCell>{t('setup.restore.colSize')}</TableCell>
                      <TableCell>{t('setup.restore.colCreated')}</TableCell>
                      <TableCell align="right">{t('setup.restore.colAction')}</TableCell>
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
                              <Chip label={t('setup.restore.gzip')} size="small" variant="outlined" sx={{ height: 20 }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{backup.sizeFormatted}</TableCell>
                        <TableCell>{formatDate(backup.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title={t('setup.restore.restoreTooltip')}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<RestoreIcon />}
                              onClick={() => openRestoreDialog(backup.filename)}
                              disabled={restoring}
                            >
                              {t('setup.restore.restoreButton')}
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'warning.main' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <RestoreIcon />
            {t('setup.restore.dialogTitle')}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" component="span">
              <strong>{t('setup.restore.warningLabel')}</strong> {t('setup.restore.dialogWarning')}
            </Typography>
          </Alert>
          <Typography variant="body2" mb={2}>
            {t('setup.restore.dialogAboutToRestore')} <strong>{restoreFilename}</strong>
          </Typography>
          <Typography variant="body2" mb={2}>
            {t('setup.restore.dialogTypeConfirm')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={restoreConfirmText}
            onChange={(e) => setRestoreConfirmText(e.target.value)}
            placeholder={t('setup.restore.placeholderConfirm')}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>{t('setup.restore.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRestore}
            disabled={restoreConfirmText !== confirmWord || restoring}
            startIcon={restoring ? <CircularProgress size={16} color="inherit" /> : <RestoreIcon />}
          >
            {restoring ? t('setup.restore.restoring') : t('setup.restore.restoreDatabase')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
