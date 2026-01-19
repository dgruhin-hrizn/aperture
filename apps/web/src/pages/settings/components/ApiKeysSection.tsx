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
      setError('Name is required')
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

      setSuccess(`API key "${keyToDelete.name}" has been revoked`)
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

  const getKeyStatus = (key: ApiKey): { label: string; color: 'success' | 'warning' | 'error' } => {
    if (key.revokedAt) {
      return { label: 'Revoked', color: 'error' }
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { label: 'Expired', color: 'warning' }
    }
    return { label: 'Active', color: 'success' }
  }

  const getExpirationDisplay = (key: ApiKey): string => {
    if (!key.expiresAt) return 'Never'
    const date = new Date(key.expiresAt)
    const now = new Date()
    if (date < now) return 'Expired'
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 1) return '1 day'
    if (days <= 30) return `${days} days`
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
              <Typography variant="h6">API Keys</Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create API Key
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            API keys allow programmatic access to the Aperture API. Keys are shown only once when created.
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
              No API keys found. Create your first API key to enable programmatic access.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Key Prefix</TableCell>
                    {apiKeys.some((k) => k.username) && <TableCell>User</TableCell>}
                    <TableCell>Status</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell>Last Used</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apiKeys.map((key) => {
                    const status = getKeyStatus(key)
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
                            label={status.label}
                            color={status.color}
                            size="small"
                            icon={
                              status.label === 'Revoked' ? (
                                <BlockIcon />
                              ) : status.label === 'Expired' ? (
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
                            {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(key.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {!key.revokedAt && (
                            <Tooltip title="Revoke key">
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
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Key Name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Home Assistant, Automation Script"
              fullWidth
              autoFocus
              helperText="A descriptive name to identify this key"
            />
            <FormControl fullWidth>
              <InputLabel>Expiration</InputLabel>
              <Select
                value={newKeyExpiration === null ? 'never' : newKeyExpiration}
                onChange={(e) =>
                  setNewKeyExpiration(e.target.value === 'never' ? null : Number(e.target.value))
                }
                label="Expiration"
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
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateKey}
            disabled={creating || !newKeyName.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {creating ? 'Creating...' : 'Create Key'}
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
          API Key Created
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Important:</strong> Copy this key now. You won't be able to see it again!
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Key name: <strong>{createdKey?.name}</strong>
          </Typography>
          <TextField
            fullWidth
            value={createdKey?.key || ''}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace' },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
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
            Done
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
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to revoke the API key <strong>"{keyToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Any applications using this key will lose access.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Revoking...' : 'Revoke Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
