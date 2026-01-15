import React, { useState, useEffect } from 'react'
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
  tables: string[]
  tableDetails: Array<{
    table: string
    count: number
    estimatedSizeMB: number
  }>
  totalRows: number
}

export function LegacyEmbeddingsSection() {
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
      if (!res.ok) throw new Error('Failed to check legacy embeddings')
      const data = await res.json()
      setLegacyInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
        throw new Error(data.error || 'Failed to delete legacy tables')
      }
      const data = await res.json()
      setSuccess(`Successfully deleted ${data.totalRowsDeleted.toLocaleString()} rows from legacy tables`)
      setLegacyInfo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleting(false)
    }
  }

  // Don't render if no legacy tables exist
  if (!loading && (!legacyInfo || !legacyInfo.exists)) {
    return null
  }

  const totalSizeMB = legacyInfo?.tableDetails.reduce((sum, t) => sum + t.estimatedSizeMB, 0) || 0

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StorageIcon color="warning" />
          <Typography variant="h6">Legacy Embedding Tables</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Checking for legacy tables...</Typography>
          </Box>
        ) : success ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            {success}
          </Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Legacy embedding tables from before the multi-dimension migration were found. 
              These tables are no longer used and can be safely deleted to free up storage.
            </Alert>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              The following tables contain old embedding data:
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {legacyInfo?.tableDetails.map((t) => (
                <Chip
                  key={t.table}
                  label={`${t.table} (${t.count.toLocaleString()} rows, ~${t.estimatedSizeMB.toFixed(1)}MB)`}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total: <strong>{legacyInfo?.totalRows.toLocaleString()}</strong> rows, 
                ~<strong>{totalSizeMB.toFixed(1)}</strong> MB storage
              </Typography>
              
              <Button
                variant="contained"
                color="error"
                startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                onClick={() => setShowConfirm(true)}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Drop Legacy Tables'}
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
        <DialogTitle>Drop Legacy Embedding Tables?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the following tables:
            <Box component="ul" sx={{ mt: 1 }}>
              {legacyInfo?.tables.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </Box>
            This action cannot be undone. Your new dimension-specific embedding tables 
            will not be affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Drop Tables
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

