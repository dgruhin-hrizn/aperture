import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Skeleton,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
} from '@mui/material'
import { StatusCard } from '@aperture/ui'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

interface HealthResponse {
  ok: boolean
  name: string
  version: string
  time: string
  database?: {
    connected: boolean
  }
}

interface Stats {
  totalUsers: number
  enabledUsers: number
  totalMovies: number
  moviesWithEmbeddings: number
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/health')
        if (response.ok) {
          const data = await response.json()
          setHealth(data)
          setHealthError(null)
        } else {
          setHealthError('Health check failed')
        }
      } catch {
        setHealthError('Could not connect to server')
      } finally {
        setHealthLoading(false)
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users count
        const usersResponse = await fetch('/api/users', { credentials: 'include' })
        let totalUsers = 0
        let enabledUsers = 0
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          totalUsers = usersData.total || 0
          enabledUsers = usersData.users?.filter((u: any) => u.is_enabled).length || 0
        }

        // Fetch movies count
        const moviesResponse = await fetch('/api/movies?pageSize=1', { credentials: 'include' })
        let totalMovies = 0
        if (moviesResponse.ok) {
          const moviesData = await moviesResponse.json()
          totalMovies = moviesData.total || 0
        }

        setStats({
          totalUsers,
          enabledUsers,
          totalMovies,
          moviesWithEmbeddings: 0, // Would need separate endpoint
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [])

  const setupChecklist = [
    { label: 'Media server connected', done: health?.ok || false },
    { label: 'Database connected', done: health?.database?.connected || false },
    { label: 'Movies synced', done: (stats?.totalMovies || 0) > 0 },
    { label: 'Users enabled', done: (stats?.enabledUsers || 0) > 0 },
  ]

  const allSetupDone = setupChecklist.every((item) => item.done)

  return (
    <Box>
      <Grid container spacing={3}>
        {/* System Status */}
        <Grid item xs={12} md={6} lg={4}>
          <StatusCard
            title="System Status"
            status={healthLoading ? 'loading' : healthError ? 'error' : health?.ok ? 'ok' : 'error'}
            message={healthError || (health?.ok ? 'All systems operational' : 'System issues detected')}
            time={health?.time}
            details={
              health
                ? {
                    Version: health.version,
                    Database: health.database?.connected ? 'Connected' : 'Disconnected',
                  }
                : undefined
            }
          />
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Quick Stats
              </Typography>

              {statsLoading ? (
                <Box>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                </Box>
              ) : stats ? (
                <Box>
                  <StatRow label="Total Users" value={stats.totalUsers} />
                  <StatRow label="AI Enabled Users" value={stats.enabledUsers} />
                  <StatRow label="Movies in Library" value={stats.totalMovies} />
                </Box>
              ) : (
                <Alert severity="warning">Could not load stats</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Setup Checklist */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Setup Status
                </Typography>
                {allSetupDone && (
                  <Chip label="Complete" color="success" size="small" />
                )}
              </Box>

              <List dense disablePadding>
                {setupChecklist.map((item, index) => (
                  <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {item.done ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <WarningIcon color="warning" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: item.done ? 'text.primary' : 'text.secondary',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Getting Started Guide */}
        {!allSetupDone && (
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" mb={2}>
                  Getting Started
                </Typography>

                <Box component="ol" sx={{ pl: 2, m: 0, mb: 3 }}>
                  <Typography component="li" variant="body2" mb={1}>
                    Configure your media server connection in <strong>Settings → System</strong>
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    Select which libraries to sync in <strong>Settings → Libraries</strong>
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    Run the "Sync Movies" job in <strong>Jobs</strong> to import your movie library
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    Enable users who should receive AI recommendations in <strong>Users</strong>
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    Run the "Generate Embeddings" job to create movie embeddings
                  </Typography>
                  <Typography component="li" variant="body2">
                    Run the "Generate Recommendations" job to create personalized picks
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => navigate('/admin/jobs')}
                >
                  Go to Jobs
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <Box display="flex" justifyContent="space-between" mb={1}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value.toLocaleString()}
      </Typography>
    </Box>
  )
}
