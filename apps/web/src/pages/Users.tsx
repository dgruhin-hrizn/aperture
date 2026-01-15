import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Chip,
  IconButton,
  Skeleton,
  Alert,
  Button,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Snackbar,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Avatar,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import RefreshIcon from '@mui/icons-material/Refresh'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import HistoryIcon from '@mui/icons-material/History'
import RecommendIcon from '@mui/icons-material/Recommend'
import FolderIcon from '@mui/icons-material/Folder'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ExploreIcon from '@mui/icons-material/Explore'

interface ProviderUser {
  providerUserId: string
  name: string
  isAdmin: boolean
  isDisabled: boolean
  lastActivityDate?: string
  apertureUserId: string | null
  isImported: boolean
  isEnabled: boolean
  moviesEnabled: boolean
  seriesEnabled: boolean
  discoverEnabled: boolean
  discoverRequestEnabled: boolean
  aiOverrideAllowed: boolean
}

interface GlobalAiConfig {
  enabled: boolean
  userOverrideAllowed: boolean
}

export function UsersPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [providerUsers, setProviderUsers] = useState<ProviderUser[]>([])
  const [provider, setProvider] = useState<string>('emby')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  // Track running jobs per user (userId -> job type)
  const [runningJobs, setRunningJobs] = useState<Map<string, string>>(new Map())
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuUser, setMenuUser] = useState<ProviderUser | null>(null)
  
  // Global AI config (to know if per-user overrides are enabled globally)
  const [globalAiConfig, setGlobalAiConfig] = useState<GlobalAiConfig | null>(null)

  const fetchGlobalAiConfig = async () => {
    try {
      const response = await fetch('/api/settings/ai-explanation', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setGlobalAiConfig(data)
      }
    } catch {
      // Silently fail
    }
  }

  const fetchProviderUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users/provider', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setProviderUsers(data.users)
        setProvider(data.provider)
        setError(null)
      } else {
        const errData = await response.json().catch(() => ({}))
        setError(errData.error || 'Failed to load users from media server')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviderUsers()
    fetchGlobalAiConfig()
  }, [])

  const handleImportUser = async (providerUserId: string, enableAfterImport: boolean = false) => {
    setImporting(providerUserId)
    try {
      const response = await fetch('/api/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ providerUserId, isEnabled: enableAfterImport }),
      })

      if (response.ok) {
        const data = await response.json()
        setProviderUsers((prev) =>
          prev.map((user) =>
            user.providerUserId === providerUserId
              ? { ...user, isImported: true, apertureUserId: data.user.id, isEnabled: enableAfterImport }
              : user
          )
        )
        setSnackbar({ open: true, message: 'User imported successfully', severity: 'success' })
      }
    } finally {
      setImporting(null)
    }
  }

  const handleToggleMovies = async (user: ProviderUser) => {
    if (!user.apertureUserId) return

    setUpdating(user.providerUserId)
    try {
      const newValue = !user.moviesEnabled
      const response = await fetch(`/api/users/${user.apertureUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moviesEnabled: newValue }),
      })

      if (response.ok) {
        setProviderUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === user.providerUserId
              ? { ...u, moviesEnabled: newValue, isEnabled: newValue || u.seriesEnabled }
              : u
          )
        )
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleSeries = async (user: ProviderUser) => {
    if (!user.apertureUserId) return

    setUpdating(user.providerUserId)
    try {
      const newValue = !user.seriesEnabled
      const response = await fetch(`/api/users/${user.apertureUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seriesEnabled: newValue }),
      })

      if (response.ok) {
        setProviderUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === user.providerUserId
              ? { ...u, seriesEnabled: newValue, isEnabled: u.moviesEnabled || newValue }
              : u
          )
        )
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleAiOverride = async (user: ProviderUser) => {
    if (!user.apertureUserId) return

    setUpdating(user.providerUserId)
    try {
      const newValue = !user.aiOverrideAllowed
      const response = await fetch(`/api/settings/ai-explanation/user/${user.apertureUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overrideAllowed: newValue }),
      })

      if (response.ok) {
        setProviderUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === user.providerUserId
              ? { ...u, aiOverrideAllowed: newValue }
              : u
          )
        )
        setSnackbar({ 
          open: true, 
          message: newValue 
            ? `${user.name} can now control their AI explanation preference` 
            : `${user.name} will use the global AI explanation setting`,
          severity: 'success' 
        })
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleDiscover = async (user: ProviderUser) => {
    if (!user.apertureUserId) return

    setUpdating(user.providerUserId)
    try {
      const newValue = !user.discoverEnabled
      const response = await fetch(`/api/users/${user.apertureUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          discoverEnabled: newValue,
          // If disabling discovery, also disable request permission
          ...(newValue === false && { discoverRequestEnabled: false }),
        }),
      })

      if (response.ok) {
        setProviderUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === user.providerUserId
              ? { 
                  ...u, 
                  discoverEnabled: newValue,
                  // If disabling discovery, also disable request permission
                  discoverRequestEnabled: newValue ? u.discoverRequestEnabled : false,
                }
              : u
          )
        )
        setSnackbar({ 
          open: true, 
          message: newValue 
            ? `${user.name} can now see discovery suggestions` 
            : `${user.name} will no longer see discovery suggestions`,
          severity: 'success' 
        })
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleDiscoverRequest = async (user: ProviderUser) => {
    if (!user.apertureUserId) return

    setUpdating(user.providerUserId)
    try {
      const newValue = !user.discoverRequestEnabled
      const response = await fetch(`/api/users/${user.apertureUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ discoverRequestEnabled: newValue }),
      })

      if (response.ok) {
        setProviderUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === user.providerUserId
              ? { ...u, discoverRequestEnabled: newValue }
              : u
          )
        )
        setSnackbar({ 
          open: true, 
          message: newValue 
            ? `${user.name} can now request discovered content` 
            : `${user.name} can no longer request discovered content`,
          severity: 'success' 
        })
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: ProviderUser) => {
    setMenuAnchor(event.currentTarget)
    setMenuUser(user)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    setMenuUser(null)
  }

  const runUserJob = async (userId: string, jobType: 'sync-history' | 'generate-recommendations' | 'update-strm' | 'run-all', userName: string) => {
    handleMenuClose()
    
    // Add this user to running jobs
    setRunningJobs(prev => new Map(prev).set(userId, jobType))
    
    try {
      const response = await fetch(`/api/users/${userId}/${jobType}`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const jobNames: Record<string, string> = {
          'sync-history': 'Watch history synced',
          'generate-recommendations': 'Recommendations generated',
          'update-strm': 'STRM files updated',
          'run-all': 'Full pipeline complete',
        }
        setSnackbar({ open: true, message: `${userName}: ${jobNames[jobType]}`, severity: 'success' })
      } else {
        const errData = await response.json().catch(() => ({}))
        setSnackbar({ open: true, message: `${userName}: ${errData.error || 'Job failed'}`, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: `${userName}: Failed to run job`, severity: 'error' })
    } finally {
      // Remove this user from running jobs
      setRunningJobs(prev => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" onClick={fetchProviderUsers} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </Box>
    )
  }

  // Sort: imported & enabled first, then imported, then non-imported
  const sortedUsers = [...providerUsers].sort((a, b) => {
    if (a.isEnabled && !b.isEnabled) return -1
    if (!a.isEnabled && b.isEnabled) return 1
    if (a.isImported && !b.isImported) return -1
    if (!a.isImported && b.isImported) return 1
    return a.name.localeCompare(b.name)
  })

  const isJobRunning = (userId: string) => runningJobs.has(userId)

  // Mobile card view
  if (isMobile) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Manage {provider.charAt(0).toUpperCase() + provider.slice(1)} users
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={fetchProviderUsers}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        </Box>

        <Stack spacing={2}>
          {sortedUsers.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.paper', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No users found on {provider} server.
              </Typography>
            </Paper>
          ) : (
            sortedUsers.map((user) => (
              <Card
                key={user.providerUserId}
                sx={{
                  backgroundColor: user.isEnabled ? 'rgba(82, 181, 75, 0.05)' : 'background.paper',
                  borderRadius: 2,
                  opacity: user.isDisabled ? 0.5 : 1,
                }}
              >
                <CardContent>
                  {/* User header with name and status */}
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: 'primary.main',
                          fontSize: '1rem',
                        }}
                      >
                        {user.name[0].toUpperCase()}
                      </Avatar>
                      <Box flex={1}>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography variant="subtitle2" fontWeight={600}>
                            {user.name}
                          </Typography>
                          {user.isAdmin && (
                            <Chip label="Admin" size="small" color="primary" sx={{ height: 20 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {user.isDisabled ? (
                            <Chip 
                              icon={<BlockIcon sx={{ fontSize: 14 }} />}
                              label={`${provider}: Disabled`}
                              size="small" 
                              color="error" 
                              variant="outlined"
                              sx={{ height: 20, mt: 0.5, fontSize: '0.7rem' }}
                            />
                          ) : (
                            <Chip 
                              label={`${provider}: Active`}
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ height: 20, mt: 0.5, fontSize: '0.7rem' }}
                            />
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                    {user.isImported && (user.moviesEnabled || user.seriesEnabled) ? (
                      <Tooltip title="Recommendations enabled">
                        <CheckCircleIcon color="success" />
                      </Tooltip>
                    ) : null}
                  </Stack>

                  {/* Import button for non-imported users */}
                  {!user.isImported && (
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      disabled={importing === user.providerUserId || user.isDisabled}
                      onClick={() => handleImportUser(user.providerUserId, true)}
                      startIcon={
                        importing === user.providerUserId ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <PersonAddIcon />
                        )
                      }
                      sx={{ mb: 2 }}
                    >
                      Enable for AI Recommendations
                    </Button>
                  )}

                  {/* Settings for imported users */}
                  {user.isImported && (
                    <>
                      {/* Media toggles in a compact row */}
                      <Stack direction="row" alignItems="center" spacing={2} mb={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <MovieIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Movies</Typography>
                          <Switch
                            checked={user.moviesEnabled}
                            onChange={() => handleToggleMovies(user)}
                            disabled={updating === user.providerUserId || user.isDisabled}
                            color="primary"
                            size="small"
                          />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <TvIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Series</Typography>
                          <Switch
                            checked={user.seriesEnabled}
                            onChange={() => handleToggleSeries(user)}
                            disabled={updating === user.providerUserId || user.isDisabled}
                            color="primary"
                            size="small"
                          />
                        </Stack>
                      </Stack>

                      {/* Discovery toggles in a compact row */}
                      <Stack direction="row" alignItems="center" spacing={2} mb={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ExploreIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Discover</Typography>
                          <Switch
                            checked={user.discoverEnabled}
                            onChange={() => handleToggleDiscover(user)}
                            disabled={updating === user.providerUserId || user.isDisabled}
                            color="primary"
                            size="small"
                          />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ExploreIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Request</Typography>
                          <Switch
                            checked={user.discoverRequestEnabled}
                            onChange={() => handleToggleDiscoverRequest(user)}
                            disabled={updating === user.providerUserId || user.isDisabled || !user.discoverEnabled}
                            color="primary"
                            size="small"
                          />
                        </Stack>
                      </Stack>

                      {/* AI Override toggle (if enabled globally) */}
                      {globalAiConfig?.userOverrideAllowed && (
                        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                          <AutoAwesomeIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>AI Override</Typography>
                          <Switch
                            checked={user.aiOverrideAllowed}
                            onChange={() => handleToggleAiOverride(user)}
                            disabled={updating === user.providerUserId || user.isDisabled}
                            color="secondary"
                            size="small"
                          />
                        </Stack>
                      )}

                      {/* Action buttons */}
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {isJobRunning(user.apertureUserId!) && (
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                        )}
                        <Tooltip title="More User Settings">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/users/${user.apertureUserId}?tab=settings`)}
                            sx={{
                              bgcolor: 'action.hover',
                              '&:hover': { bgcolor: 'action.selected' },
                            }}
                          >
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {user.isEnabled && (
                          <Tooltip title="User Actions">
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, user)}
                              disabled={isJobRunning(user.apertureUserId!)}
                              sx={{
                                bgcolor: 'action.hover',
                                '&:hover': { bgcolor: 'action.selected' },
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>

        {/* Actions Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem 
            onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'run-all', menuUser.name)}
            sx={{ color: 'primary.main' }}
          >
            <ListItemIcon>
              <PlayArrowIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary="Run Full Pipeline" secondary="Sync → Recommend → STRM" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'sync-history', menuUser.name)}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sync Watch History" />
          </MenuItem>
          <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'generate-recommendations', menuUser.name)}>
            <ListItemIcon>
              <RecommendIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Generate Recommendations" />
          </MenuItem>
          <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'update-strm', menuUser.name)}>
            <ListItemIcon>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Update STRM Files" />
          </MenuItem>
        </Menu>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))} 
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    )
  }

  // Desktop table view
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Manage {provider.charAt(0).toUpperCase() + provider.slice(1)} users and enable AI recommendations
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={fetchProviderUsers}
          startIcon={<RefreshIcon />}
        >
          Refresh
        </Button>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Imported</TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <MovieIcon fontSize="small" />
                  Movies
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <TvIcon fontSize="small" />
                  Series
                </Box>
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Show discovery suggestions for content not in library">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <ExploreIcon fontSize="small" />
                    Discover
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Allow user to request discovered content via Jellyseerr">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <ExploreIcon fontSize="small" />
                    Request
                  </Box>
                </Tooltip>
              </TableCell>
              {globalAiConfig?.userOverrideAllowed && (
                <TableCell align="center">
                  <Tooltip title="Allow user to control their AI explanation preference">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <AutoAwesomeIcon fontSize="small" />
                      AI Override
                    </Box>
                  </Tooltip>
                </TableCell>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={globalAiConfig?.userOverrideAllowed ? 9 : 8} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    No users found on {provider} server.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow 
                  key={user.providerUserId} 
                  hover
                  sx={{ 
                    opacity: user.isDisabled ? 0.5 : 1,
                    backgroundColor: user.isEnabled ? 'rgba(82, 181, 75, 0.05)' : 'inherit'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {user.name}
                      </Typography>
                      {user.isAdmin && (
                        <Chip label="Admin" size="small" color="primary" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.isDisabled ? (
                      <Chip 
                        icon={<BlockIcon />}
                        label="Disabled in Emby" 
                        size="small" 
                        color="error" 
                        variant="outlined"
                      />
                    ) : (
                      <Chip 
                        label="Active" 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.isImported ? (
                      <Tooltip title="User imported to Aperture">
                        <CheckCircleIcon color="success" />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Not yet imported">
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.isImported ? (
                      <Switch
                        checked={user.moviesEnabled}
                        onChange={() => handleToggleMovies(user)}
                        disabled={updating === user.providerUserId || user.isDisabled}
                        color="primary"
                        size="small"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.isImported ? (
                      <Switch
                        checked={user.seriesEnabled}
                        onChange={() => handleToggleSeries(user)}
                        disabled={updating === user.providerUserId || user.isDisabled}
                        color="primary"
                        size="small"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.isImported ? (
                      <Tooltip title={user.discoverEnabled ? 'Disable discovery suggestions' : 'Enable discovery suggestions'}>
                        <Switch
                          checked={user.discoverEnabled}
                          onChange={() => handleToggleDiscover(user)}
                          disabled={updating === user.providerUserId || user.isDisabled}
                          color="primary"
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.isImported ? (
                      <Tooltip title={user.discoverRequestEnabled ? 'Disable content requests' : 'Enable content requests'}>
                        <Switch
                          checked={user.discoverRequestEnabled}
                          onChange={() => handleToggleDiscoverRequest(user)}
                          disabled={updating === user.providerUserId || user.isDisabled || !user.discoverEnabled}
                          color="primary"
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  {globalAiConfig?.userOverrideAllowed && (
                    <TableCell align="center">
                      {user.isImported ? (
                        <Switch
                          checked={user.aiOverrideAllowed}
                          onChange={() => handleToggleAiOverride(user)}
                          disabled={updating === user.providerUserId || user.isDisabled}
                          color="secondary"
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {!user.isImported && (
                        <Tooltip title="Import & Enable for AI Recommendations">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              disabled={importing === user.providerUserId || user.isDisabled}
                              onClick={() => handleImportUser(user.providerUserId, true)}
                              startIcon={
                                importing === user.providerUserId ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <PersonAddIcon />
                                )
                              }
                            >
                              Enable
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                      {user.isImported && user.apertureUserId && (
                        <>
                          {isJobRunning(user.apertureUserId) && (
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                          )}
                          <Tooltip title="More User Settings">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/users/${user.apertureUserId}?tab=settings`)}
                            >
                              <SettingsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {user.isEnabled && (
                            <Tooltip title="User Actions">
                              <IconButton
                                size="small"
                                onClick={(e) => handleMenuOpen(e, user)}
                                disabled={isJobRunning(user.apertureUserId)}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem 
          onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'run-all', menuUser.name)}
          sx={{ color: 'primary.main' }}
        >
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Run Full Pipeline" secondary="Sync → Recommend → STRM" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'sync-history', menuUser.name)}>
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sync Watch History" />
        </MenuItem>
        <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'generate-recommendations', menuUser.name)}>
          <ListItemIcon>
            <RecommendIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Generate Recommendations" />
        </MenuItem>
        <MenuItem onClick={() => menuUser?.apertureUserId && runUserJob(menuUser.apertureUserId, 'update-strm', menuUser.name)}>
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Update STRM Files" />
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
