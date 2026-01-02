import React, { useEffect, useState } from 'react'
import { Box, Typography, Grid, Card, CardContent, Skeleton } from '@mui/material'
import { StatusCard } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

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
  pendingJobs: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

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
    const interval = setInterval(fetchHealth, 30000) // Refresh every 30s

    return () => clearInterval(interval)
  }, [])

  // Placeholder stats - in production these would come from API
  useEffect(() => {
    setStats({
      totalUsers: 0,
      enabledUsers: 0,
      totalMovies: 0,
      pendingJobs: 0,
    })
  }, [])

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Welcome back, {user?.displayName || user?.username}
      </Typography>

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
          <Card
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent>
              <Typography variant="h6" mb={2}>
                Quick Stats
              </Typography>

              {stats ? (
                <Box>
                  <StatRow label="Total Users" value={stats.totalUsers} />
                  <StatRow label="Enabled Users" value={stats.enabledUsers} />
                  <StatRow label="Movies" value={stats.totalMovies} />
                  <StatRow label="Pending Jobs" value={stats.pendingJobs} />
                </Box>
              ) : (
                <Box>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6} lg={4}>
          <Card
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent>
              <Typography variant="h6" mb={2}>
                Recent Activity
              </Typography>

              <Typography variant="body2" color="text.secondary">
                No recent activity to display.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Getting Started */}
        <Grid item xs={12}>
          <Card
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Typography variant="h6" mb={2}>
                Getting Started
              </Typography>

              <Box component="ol" sx={{ pl: 2, m: 0 }}>
                <Typography component="li" variant="body2" mb={1}>
                  Configure your media server connection in Settings
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  Run the "Sync Movies" job to import your movie library
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  Enable users who should receive AI recommendations
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  Run the "Generate Embeddings" job to create movie embeddings
                </Typography>
                <Typography component="li" variant="body2">
                  Run the "Generate Recommendations" job to create personalized picks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
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

