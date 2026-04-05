import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  InputAdornment,
} from '@mui/material'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import WarningIcon from '@mui/icons-material/Warning'
import BlockIcon from '@mui/icons-material/Block'

interface ApiKey {
  id: string
  userId: string
  name: string
  keyPrefix: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
  // For admin view
  username?: string
  displayName?: string | null
}

interface ExpirationOption {
  label: string
  days: number | null
}

export function ApiKeysSection() {
  const { t } = useTranslation()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [expirationOptions, setExpirationOptions] = useState<ExpirationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiration, setNewKeyExpiration] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  // Created key display state (shown only once)
  const [createdKey, setCreatedKey] = useState<{ key: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/api-keys', { credentials: 'include' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load API keys')
      }

      const data = await res.json()
      setApiKeys(data.keys || [])
      setExpirationOptions(data.expirationOptions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setError(t('settingsApiKeys.errNameRequired'))
      return
    }

    try {
      setCreating(true)
      setError(null)

      const res = await fetch('/api/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          expiresInDays: newKeyExpiration,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create API key')
      }

      // Show the created key (only time it's visible)
      setCreatedKey({ key: data.plaintextKey, name: newKeyName.trim() })
      setCreateDialogOpen(false)
      setNewKeyName('')
      setNewKeyExpiration(null)
      await fetchApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseCreatedKey = () => {
    setCreatedKey(null)
    setCopied(false)
  }

  const handleDeleteClick = (key: ApiKey) => {
    setKeyToDelete(key)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return

    try {
      setDeleting(true)
      setError(null)

      const res = await fetch(`/api/api-keys/${keyToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete API key')
      }

      setSuccess(t('settingsApiKeys.revokedSuccess', { name: keyToDelete.name }))
      setDeleteDialogOpen(false)
      setKeyToDelete(null)
      await fetchApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getKeyStatus = (key: ApiKey): { status: 'revoked' | 'expired' | 'active'; color: 'success' | 'warning' | 'error' } => {
    if (key.revokedAt) {
      return { status: 'revoked', color: 'error' }
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { status: 'expired', color: 'warning' }
    }
    return { status: 'active', color: 'success' }
  }

  const getExpirationDisplay = (key: ApiKey): string => {
    if (!key.expiresAt) return t('settingsApiKeys.never')
    const date = new Date(key.expiresAt)
    const now = new Date()
    if (date < now) return t('settingsApiKeys.expired')
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 1) return t('settingsApiKeys.expiresOneDay')
    if (days <= 30) return t('settingsApiKeys.expiresDays', { count: days })
    return formatDate(key.expiresAt)
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
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <VpnKeyIcon color="primary" />
              <Typography variant="h6">{t('settingsApiKeys.title')}</Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              {t('settingsApiKeys.createButton')}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settingsApiKeys.subtitle')}
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

          {apiKeys.length === 0 ? (
            <Alert severity="info">
              {t('settingsApiKeys.empty')}
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('settingsApiKeys.colName')}</TableCell>
                    <TableCell>{t('settingsApiKeys.colPrefix')}</TableCell>
                    {apiKeys.some((k) => k.username) && <TableCell>{t('settingsApiKeys.colUser')}</TableCell>}
                    <TableCell>{t('settingsApiKeys.colStatus')}</TableCell>
                    <TableCell>{t('settingsApiKeys.colExpires')}</TableCell>
                    <TableCell>{t('settingsApiKeys.colLastUsed')}</TableCell>
                    <TableCell>{t('settingsApiKeys.colCreated')}</TableCell>
                    <TableCell align="right">{t('settingsApiKeys.colActions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apiKeys.map((key) => {
                    const keyStatus = getKeyStatus(key)
                    const statusLabel =
                      keyStatus.status === 'revoked'
                        ? t('settingsApiKeys.statusRevoked')
                        : keyStatus.status === 'expired'
                          ? t('settingsApiKeys.statusExpired')
                          : t('settingsApiKeys.statusActive')
                    return (
                      <TableRow key={key.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {key.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontFamily="monospace"
                            sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}
                          >
                            {key.keyPrefix}...
                          </Typography>
                        </TableCell>
                        {apiKeys.some((k) => k.username) && (
                          <TableCell>
                            <Typography variant="body2">
                              {key.displayName || key.username || '—'}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Chip
                            label={statusLabel}
                            color={keyStatus.color}
                            size="small"
                            icon={
                              keyStatus.status === 'revoked' ? (
                                <BlockIcon />
                              ) : keyStatus.status === 'expired' ? (
                                <WarningIcon />
                              ) : (
                                <CheckIcon />
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {getExpirationDisplay(key)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {key.lastUsedAt ? formatDate(key.lastUsedAt) : t('settingsApiKeys.never')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(key.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {!key.revokedAt && (
                            <Tooltip title={t('settingsApiKeys.revokeTooltip')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(key)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settingsApiKeys.dialogCreateTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('settingsApiKeys.keyNameLabel')}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t('settingsApiKeys.keyNamePlaceholder')}
              fullWidth
              autoFocus
              helperText={t('settingsApiKeys.keyNameHelper')}
            />
            <FormControl fullWidth>
              <InputLabel>{t('settingsApiKeys.expirationLabel')}</InputLabel>
              <Select
                value={newKeyExpiration === null ? 'never' : newKeyExpiration}
                onChange={(e) =>
                  setNewKeyExpiration(e.target.value === 'never' ? null : Number(e.target.value))
                }
                label={t('settingsApiKeys.expirationLabel')}
              >
                {expirationOptions.map((opt) => (
                  <MenuItem key={opt.label} value={opt.days === null ? 'never' : opt.days}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleCreateKey}
            disabled={creating || !newKeyName.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {creating ? t('settingsApiKeys.creating') : t('settingsApiKeys.createKey')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Created Key Display Dialog */}
      <Dialog
        open={!!createdKey}
        onClose={handleCloseCreatedKey}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon color="success" />
          {t('settingsApiKeys.createdTitle')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{t('settingsApiKeys.createdWarning')}</strong> {t('settingsApiKeys.createdWarningBody')}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('settingsApiKeys.keyNameLine', { name: createdKey?.name ?? '' })}
          </Typography>
          <TextField
            fullWidth
            value={createdKey?.key || ''}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace' },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={copied ? t('settingsApiKeys.copied') : t('settingsApiKeys.copyTooltip')}>
                    <IconButton onClick={handleCopyKey} edge="end">
                      {copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCloseCreatedKey}>
            {t('settingsApiKeys.done')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('settingsApiKeys.revokeDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('settingsApiKeys.revokeConfirm', { name: keyToDelete?.name ?? '' })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('settingsApiKeys.revokeWarning')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? t('settingsApiKeys.revoking') : t('settingsApiKeys.revokeKey')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
