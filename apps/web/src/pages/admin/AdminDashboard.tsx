import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
          setHealthError(t('admin.dashboard.healthCheckFailed'))
        }
      } catch {
        setHealthError(t('admin.dashboard.couldNotConnect'))
      } finally {
        setHealthLoading(false)
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [t])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersResponse = await fetch('/api/users', { credentials: 'include' })
        let totalUsers = 0
        let enabledUsers = 0
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          totalUsers = usersData.total || 0
          enabledUsers = usersData.users?.filter((u: { is_enabled?: boolean }) => u.is_enabled).length || 0
        }

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
          moviesWithEmbeddings: 0,
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
    { label: t('admin.dashboard.checklistMediaServer'), done: health?.ok || false },
    { label: t('admin.dashboard.checklistDatabase'), done: health?.database?.connected || false },
    { label: t('admin.dashboard.checklistMovies'), done: (stats?.totalMovies || 0) > 0 },
    { label: t('admin.dashboard.checklistUsers'), done: (stats?.enabledUsers || 0) > 0 },
  ]

  const allSetupDone = setupChecklist.every((item) => item.done)

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <StatusCard
            title={t('admin.dashboard.systemStatus')}
            status={healthLoading ? 'loading' : healthError ? 'error' : health?.ok ? 'ok' : 'error'}
            message={
              healthError || (health?.ok ? t('admin.dashboard.allOperational') : t('admin.dashboard.systemIssues'))
            }
            time={health?.time}
            details={
              health
                ? {
                    [t('admin.dashboard.version')]: health.version,
                    [t('admin.dashboard.database')]: health.database?.connected
                      ? t('admin.dashboard.connected')
                      : t('admin.dashboard.disconnected'),
                  }
                : undefined
            }
          />
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" mb={2}>
                {t('admin.dashboard.quickStats')}
              </Typography>

              {statsLoading ? (
                <Box>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                </Box>
              ) : stats ? (
                <Box>
                  <StatRow label={t('admin.dashboard.totalUsers')} value={stats.totalUsers} />
                  <StatRow label={t('admin.dashboard.aiEnabledUsers')} value={stats.enabledUsers} />
                  <StatRow label={t('admin.dashboard.moviesInLibrary')} value={stats.totalMovies} />
                </Box>
              ) : (
                <Alert severity="warning">{t('admin.dashboard.couldNotLoadStats')}</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('admin.dashboard.setupStatus')}</Typography>
                {allSetupDone && <Chip label={t('admin.dashboard.complete')} color="success" size="small" />}
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

        {!allSetupDone && (
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" mb={2}>
                  {t('admin.dashboard.gettingStarted')}
                </Typography>

                <Box component="ol" sx={{ pl: 2, m: 0, mb: 3 }}>
                  <Typography component="li" variant="body2" mb={1}>
                    {t('admin.dashboard.step1')}
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    {t('admin.dashboard.step2')}
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    {t('admin.dashboard.step3')}
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    {t('admin.dashboard.step4')}
                  </Typography>
                  <Typography component="li" variant="body2" mb={1}>
                    {t('admin.dashboard.step5')}
                  </Typography>
                  <Typography component="li" variant="body2">
                    {t('admin.dashboard.step6')}
                  </Typography>
                </Box>

                <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => navigate('/admin/jobs')}>
                  {t('admin.dashboard.goToJobs')}
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
