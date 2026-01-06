import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Skeleton,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Pagination,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Divider,
  Button,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SaveIcon from '@mui/icons-material/Save'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import FavoriteIcon from '@mui/icons-material/Favorite'
import { MoviePoster } from '@aperture/ui'
import { Breadcrumbs } from '@/components/Breadcrumbs'

interface User {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  is_admin: boolean
  is_enabled: boolean
  movies_enabled: boolean
  series_enabled: boolean
  can_manage_watch_history: boolean
  created_at: string
}

interface Recommendation {
  movie_id: string
  rank: number
  final_score: number
  movie: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
  }
}

interface WatchHistoryItem {
  movie_id: string
  play_count: number
  is_favorite: boolean
  last_played_at: string | null
  title: string
  year: number | null
  poster_url: string | null
  genres: string[]
  community_rating: number | null
  overview: string | null
}

interface WatchHistoryResponse {
  history: WatchHistoryItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box pt={3}>{children}</Box>}
    </div>
  )
}

// User Settings Tab Component (Admin only)
function UserSettingsTab({ userId, user }: { userId: string; user: User }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingWatchHistory, setSavingWatchHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [canManageWatchHistory, setCanManageWatchHistory] = useState(user.can_manage_watch_history)
  const [settings, setSettings] = useState<{
    overrideAllowed: boolean
    enabled: boolean | null
    effectiveValue: boolean
    globalConfig: { enabled: boolean; userOverrideAllowed: boolean }
  } | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/settings/ai-explanation/user/${userId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (err) {
      console.error('Failed to fetch user AI settings:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!settings) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/settings/ai-explanation/user/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideAllowed: settings.overrideAllowed }),
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to save settings')
      const data = await response.json()
      setSettings({
        ...settings,
        effectiveValue: data.effectiveValue,
      })
      setSuccess('User settings saved!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleWatchHistoryToggle = async (enabled: boolean) => {
    try {
      setSavingWatchHistory(true)
      setError(null)
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canManageWatchHistory: enabled }),
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to update permission')
      setCanManageWatchHistory(enabled)
      setSuccess('Watch history permission updated!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Revert the toggle on error
      setCanManageWatchHistory(!enabled)
    } finally {
      setSavingWatchHistory(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings) {
    return (
      <Alert severity="error">Failed to load user settings</Alert>
    )
  }

  return (
    <Box>
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

      {/* Watch History Management Permission */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            Watch History Management
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Allow this user to mark movies and series as unwatched. This will update both the media server (Emby/Jellyfin) and Aperture's database.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={canManageWatchHistory}
                onChange={(e) => handleWatchHistoryToggle(e.target.checked)}
                disabled={savingWatchHistory}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  Allow Watch History Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User can mark items as unwatched from their Watch History page and movie detail pages
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />

          {savingWatchHistory && (
            <Box display="flex" alignItems="center" gap={1} mt={2}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Saving...</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon color="primary" />
            AI Explanation Settings
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Control whether this user can customize their AI explanation preferences.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Global Setting Status */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Global Setting:</strong> AI explanations are {settings.globalConfig.enabled ? 'enabled' : 'disabled'} by default
              {settings.globalConfig.userOverrideAllowed 
                ? ' (per-user overrides allowed)' 
                : ' (per-user overrides disabled globally)'}
            </Typography>
          </Box>

          {/* Override Permission Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={settings.overrideAllowed}
                onChange={(e) => setSettings({ ...settings, overrideAllowed: e.target.checked })}
                disabled={!settings.globalConfig.userOverrideAllowed}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  Allow This User to Override
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  When enabled, this user can toggle AI explanations on/off for their own recommendations
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, mb: 2 }}
          />

          {!settings.globalConfig.userOverrideAllowed && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Per-user overrides are disabled globally. Enable "Allow Per-User Overrides" in Settings → AI Config → Algorithm to grant users override permission.
            </Alert>
          )}

          {/* Current Effective Value */}
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 2 }}>
            <Typography variant="body2">
              <strong>Effective Value for This User:</strong>{' '}
              {settings.effectiveValue ? 'AI explanations are INCLUDED' : 'AI explanations are EXCLUDED'}
            </Typography>
            {settings.overrideAllowed && settings.enabled !== null && (
              <Typography variant="caption" color="text.secondary">
                (User has chosen to {settings.enabled ? 'enable' : 'disable'} AI explanations)
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !settings.globalConfig.userOverrideAllowed}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

// Watch History Tab Component
function WatchHistoryTab({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState<WatchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [sortBy, setSortBy] = useState<'recent' | 'plays' | 'title'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const fetchHistory = useCallback(async (page: number, sort: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/users/${userId}/watch-history?page=${page}&pageSize=50&sortBy=${sort}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data: WatchHistoryResponse = await response.json()
        setHistory(data.history)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch watch history:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchHistory(pagination.page, sortBy)
  }, [fetchHistory, sortBy, pagination.page])

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    fetchHistory(page, sortBy)
  }

  const handleSortChange = (_: React.MouseEvent<HTMLElement>, newSort: 'recent' | 'plays' | 'title' | null) => {
    if (newSort) {
      setSortBy(newSort)
      fetchHistory(1, newSort)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  if (loading && history.length === 0) {
    return (
      <Box>
        <Grid container spacing={2}>
          {[...Array(12)].map((_, i) => (
            <Grid item key={i}>
              <Skeleton variant="rectangular" width={140} height={210} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (history.length === 0) {
    return (
      <Typography color="text.secondary">
        No watch history found. Run the watch history sync job to import data from the media server.
      </Typography>
    )
  }

  return (
    <Box>
      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {pagination.total.toLocaleString()} movies watched
          </Typography>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={handleSortChange}
            size="small"
          >
            <ToggleButton value="recent">Recent</ToggleButton>
            <ToggleButton value="plays">Most Played</ToggleButton>
            <ToggleButton value="title">A-Z</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {loading && <CircularProgress size={20} />}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <Grid container spacing={2}>
          {history.map((item) => (
            <Grid item key={item.movie_id}>
              <Box position="relative">
                <MoviePoster
                  title={item.title}
                  year={item.year}
                  posterUrl={item.poster_url}
                  genres={item.genres}
                  rating={item.community_rating}
                  overview={item.overview}
                  size="medium"
                  onClick={() => navigate(`/movies/${item.movie_id}`)}
                />
                {/* Play count badge - cap display at 5x, show "Rewatched" for higher */}
                {item.play_count > 1 && (
                  <Chip
                    label={item.play_count <= 5 ? `${item.play_count}x` : 'Rewatched'}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                )}
                {/* Favorite badge */}
                {item.is_favorite && (
                  <FavoriteIcon
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      color: 'error.main',
                      fontSize: 20,
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                    }}
                  />
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Movie</TableCell>
                <TableCell align="center">Plays</TableCell>
                <TableCell align="center">Rating</TableCell>
                <TableCell align="right">Last Watched</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((item) => (
                <TableRow 
                  key={item.movie_id} 
                  hover 
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/movies/${item.movie_id}`)}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Box
                        component="img"
                        src={item.poster_url || undefined}
                        alt={item.title}
                        sx={{
                          width: 40,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 0.5,
                          backgroundColor: 'grey.800',
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.title}
                          {item.is_favorite && (
                            <FavoriteIcon sx={{ ml: 0.5, fontSize: 14, color: 'error.main', verticalAlign: 'middle' }} />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.year} • {item.genres?.slice(0, 2).join(', ')}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={item.play_count <= 5 ? item.play_count : '5+'} 
                      size="small" 
                      color={item.play_count > 3 ? 'primary' : 'default'}
                      variant={item.play_count > 1 ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {item.community_rating ? (
                      <Typography variant="body2">
                        {Number(item.community_rating).toFixed(1)}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(item.last_played_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  )
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user
        const userResponse = await fetch(`/api/users/${id}`, { credentials: 'include' })
        if (!userResponse.ok) {
          setError('User not found')
          return
        }
        const userData = await userResponse.json()
        setUser(userData)

        // Fetch recommendations
        const recsResponse = await fetch(`/api/recommendations/${id}`, { credentials: 'include' })
        if (recsResponse.ok) {
          const recsData = await recsResponse.json()
          setRecommendations(recsData.recommendations || [])
        }
      } catch {
        setError('Could not load user data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
      </Box>
    )
  }

  if (error || !user) {
    return (
      <Box>
        <Breadcrumbs
          items={[
            { label: 'Admin', path: '/admin' },
            { label: 'Users', path: '/admin/users' },
            { label: 'User' },
          ]}
        />
        <Alert severity="error">{error || 'User not found'}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Breadcrumbs
        items={[
          { label: 'Admin', path: '/admin' },
          { label: 'Users', path: '/admin/users' },
        ]}
        currentLabel={user.display_name || user.username}
      />

      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Typography variant="h5" fontWeight={700}>
          {user.display_name || user.username}
        </Typography>
        {user.is_admin && <Chip label="Admin" size="small" color="primary" />}
        {user.movies_enabled && (
          <Chip label="Movies" size="small" color="success" variant="filled" />
        )}
        {user.series_enabled && (
          <Chip label="Series" size="small" color="success" variant="filled" />
        )}
        {!user.movies_enabled && !user.series_enabled && (
          <Chip label="AI Disabled" size="small" color="default" variant="outlined" />
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" mb={3}>
        @{user.username} • {user.provider} • Joined {new Date(user.created_at).toLocaleDateString()}
      </Typography>

      <Paper sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2, pt: 1 }}>
          <Tab label="Recommendations" />
          <Tab label="Watch History" />
          <Tab label="Playlists" />
          <Tab label="Diagnostics" />
          <Tab label="Settings" />
        </Tabs>

        <Box p={3}>
          <TabPanel value={tabValue} index={0}>
            {recommendations.length === 0 ? (
              <Typography color="text.secondary">
                No recommendations generated yet. Run the recommendations job to generate picks for this user.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {recommendations.map((rec) => (
                  <Grid item key={rec.movie_id}>
                    <MoviePoster
                      title={rec.movie.title}
                      year={rec.movie.year}
                      posterUrl={rec.movie.poster_url}
                      genres={rec.movie.genres}
                      score={rec.final_score}
                      showScore
                      size="medium"
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <WatchHistoryTab userId={user.id} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography color="text.secondary">
              User playlists will appear here.
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography color="text.secondary">
              Recommendation diagnostics and score breakdowns will appear here.
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <UserSettingsTab userId={user.id} user={user} />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}

