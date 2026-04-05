import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import StorageIcon from '@mui/icons-material/Storage'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface LegacyInfo {
  exists: boolean
  tables: Array<{
    name: string
    rowCount: number
  }>
  totalRows: number
}

export function LegacyEmbeddingsSection() {
  const { t } = useTranslation()
  const [legacyInfo, setLegacyInfo] = useState<LegacyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchLegacyInfo = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/ai/embeddings/legacy')
      if (!res.ok) throw new Error(t('settingsLegacyEmbeddings.checkFailed'))
      const data = await res.json()
      setLegacyInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsLegacyEmbeddings.unknownError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLegacyInfo()
  }, [])

  const handleDelete = async () => {
    try {
      setDeleting(true)
      setShowConfirm(false)
      setError(null)
      const res = await fetch('/api/settings/ai/embeddings/legacy', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('settingsLegacyEmbeddings.deleteFailed'))
      }
      const data = await res.json()
      setSuccess(
        t('settingsLegacyEmbeddings.deleteSuccess', {
          count: data.totalRowsDeleted.toLocaleString(),
        }),
      )
      setLegacyInfo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsLegacyEmbeddings.unknownError'))
    } finally {
      setDeleting(false)
    }
  }

  // Don't render if no legacy tables exist
  if (!loading && (!legacyInfo || !legacyInfo.exists)) {
    return null
  }

  // Estimate ~8KB per embedding row (3072 floats * 2 bytes for halfvec + overhead)
  const estimatedSizeMB = (legacyInfo?.totalRows || 0) * 8 / 1024

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StorageIcon color="warning" />
          <Typography variant="h6">{t('settingsLegacyEmbeddings.title')}</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>{t('settingsLegacyEmbeddings.checking')}</Typography>
          </Box>
        ) : success ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            {success}
          </Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('settingsLegacyEmbeddings.warningBody')}
            </Alert>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('settingsLegacyEmbeddings.tablesIntro')}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {legacyInfo?.tables.map((tbl) => (
                <Chip
                  key={tbl.name}
                  label={t('settingsLegacyEmbeddings.tableRows', {
                    name: tbl.name,
                    count: tbl.rowCount.toLocaleString(),
                  })}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('settingsLegacyEmbeddings.totalLine', {
                  rows: legacyInfo?.totalRows.toLocaleString() ?? '0',
                  mb: estimatedSizeMB.toFixed(1),
                })}
              </Typography>
              
              <Button
                variant="contained"
                color="error"
                startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                onClick={() => setShowConfirm(true)}
                disabled={deleting}
              >
                {deleting ? t('settingsLegacyEmbeddings.deleting') : t('settingsLegacyEmbeddings.dropButton')}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={showConfirm} onClose={() => setShowConfirm(false)}>
        <DialogTitle>{t('settingsLegacyEmbeddings.dialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settingsLegacyEmbeddings.dialogBody')}
            <Box component="ul" sx={{ mt: 1 }}>
              {legacyInfo?.tables.map((tbl) => (
                <li key={tbl.name}>
                  {t('settingsLegacyEmbeddings.tableRows', {
                    name: tbl.name,
                    count: tbl.rowCount.toLocaleString(),
                  })}
                </li>
              ))}
            </Box>
            {t('settingsLegacyEmbeddings.dialogFooter')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirm(false)}>{t('settingsLegacyEmbeddings.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('settingsLegacyEmbeddings.confirmDrop')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

