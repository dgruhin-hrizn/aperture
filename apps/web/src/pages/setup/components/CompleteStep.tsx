import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  OpenInNew as OpenInNewIcon,
  AutoAwesome as AutoAwesomeIcon,
  Person as PersonIcon,
  Login as LoginIcon,
  LiveTv as LiveTvIcon,
  Extension as ExtensionIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext, UserLibraryResult } from '../types'

interface CompleteStepProps {
  wizard: SetupWizardContext
}

function LibrarySummarySection({
  typeLabel,
  users,
  icon,
}: {
  typeLabel: string
  users: UserLibraryResult[]
  icon: React.ReactNode
}) {
  const { t } = useTranslation()

  if (!users || users.length === 0) return null

  const successUsers = users.filter((u) => u.status === 'success')
  const skippedUsers = users.filter((u) => u.status === 'skipped')
  const failedUsers = users.filter((u) => u.status === 'failed')
  const totalRecs = successUsers.reduce((sum, u) => sum + (u.recommendationCount || 0), 0)

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight={600}>
          {typeLabel}
        </Typography>
        <Chip
          label={t('setup.complete.recommendationsChip', { count: totalRecs })}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </Box>

      <List dense disablePadding>
        {successUsers.map((user) => (
          <ListItem key={user.userId} sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText
              primary={
                user.libraryName ||
                t('setup.complete.aiPicksPrimary', { name: user.displayName })
              }
              secondary={t('setup.complete.recommendationsChip', {
                count: user.recommendationCount ?? 0,
              })}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        ))}

        {skippedUsers.map((user) => (
          <ListItem key={user.userId} sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <WarningIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText
              primary={user.displayName}
              secondary={user.error || t('setup.complete.skippedNoHistory')}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption', color: 'warning.main' }}
            />
          </ListItem>
        ))}

        {failedUsers.map((user) => (
          <ListItem key={user.userId} sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ErrorIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText
              primary={user.displayName}
              secondary={user.error || t('setup.complete.failed')}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption', color: 'error.main' }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}

function TopPicksSummarySection({
  moviesCount,
  seriesCount,
}: {
  moviesCount: number
  seriesCount: number
}) {
  const { t } = useTranslation()

  if (moviesCount === 0 && seriesCount === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TrendingUpIcon fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('setup.complete.topPicksGlobal')}
        </Typography>
      </Box>

      <List dense disablePadding>
        {moviesCount > 0 && (
          <ListItem sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText
              primary={t('setup.complete.topPicksMovies')}
              secondary={t('setup.complete.topPicksMoviesSecondary', { count: moviesCount })}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        )}
        {seriesCount > 0 && (
          <ListItem sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText
              primary={t('setup.complete.topPicksSeries')}
              secondary={t('setup.complete.topPicksSeriesSecondary', { count: seriesCount })}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        )}
      </List>
    </Box>
  )
}

export function CompleteStep({ wizard }: CompleteStepProps) {
  const { t } = useTranslation()
  const { handleCompleteSetup, jobsProgress, serverName, serverType, goToStep } = wizard

  // Extract library results from completed sync jobs
  const movieSyncJob = jobsProgress.find((j) => j.id === 'sync-movie-libraries')
  const seriesSyncJob = jobsProgress.find((j) => j.id === 'sync-series-libraries')
  const topPicksJob = jobsProgress.find((j) => j.id === 'refresh-top-picks')

  const movieUsers = movieSyncJob?.result?.users || []
  const seriesUsers = seriesSyncJob?.result?.users || []

  // Top Picks results
  const topPicksMoviesCount = topPicksJob?.result?.moviesCount || 0
  const topPicksSeriesCount = topPicksJob?.result?.seriesCount || 0
  const hasTopPicks = topPicksMoviesCount > 0 || topPicksSeriesCount > 0

  const hasMovieLibraries = movieUsers.some((u) => u.status === 'success')
  const hasSeriesLibraries = seriesUsers.some((u) => u.status === 'success')
  const hasAnyLibraries = hasMovieLibraries || hasSeriesLibraries || hasTopPicks
  const hasAnyIssues = [...movieUsers, ...seriesUsers].some(
    (u) => u.status === 'skipped' || u.status === 'failed'
  )

  const serverDisplayName = serverName || serverType || t('setup.complete.mediaServerFallback')

  return (
    <Box>
      {/* Success Header */}
      <Box textAlign="center" sx={{ mb: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          {t('setup.complete.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('setup.complete.subtitle')}
        </Typography>
      </Box>

      {/* Issues Alert */}
      {hasAnyIssues && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">{t('setup.complete.issuesAlert')}</Typography>
        </Alert>
      )}

      {/* Created Libraries Summary */}
      {hasAnyLibraries && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon color="primary" />
              <Typography variant="h6">
                {t('setup.complete.librariesCreatedIn', { name: serverDisplayName })}
              </Typography>
            </Box>

            <LibrarySummarySection
              typeLabel={t('setup.complete.movies')}
              users={movieUsers}
              icon={<MovieIcon fontSize="small" color="primary" />}
            />

            {hasMovieLibraries && hasSeriesLibraries && <Divider sx={{ my: 2 }} />}

            <LibrarySummarySection
              typeLabel={t('setup.complete.tvSeries')}
              users={seriesUsers}
              icon={<TvIcon fontSize="small" color="primary" />}
            />

            {(hasMovieLibraries || hasSeriesLibraries) && hasTopPicks && <Divider sx={{ my: 2 }} />}

            <TopPicksSummarySection moviesCount={topPicksMoviesCount} seriesCount={topPicksSeriesCount} />
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      <Card variant="outlined" sx={{ mb: 3, backgroundColor: 'action.hover' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('setup.complete.gettingStarted')}
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <LoginIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.loginPrimary')}
                secondary={t('setup.complete.loginSecondary')}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <OpenInNewIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.openServerPrimary')}
                secondary={t('setup.complete.openServerSecondary')}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Default Schedules */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6">{t('setup.complete.schedulesTitle')}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('setup.complete.schedulesIntro')}
          </Typography>

          <List dense disablePadding>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={t('setup.complete.schedWatchHistory')}
                secondary={t('setup.complete.schedWatchHistoryDesc')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={t('setup.complete.schedLibraryScan')}
                secondary={t('setup.complete.schedLibraryScanDesc')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={t('setup.complete.schedEmbeddings')}
                secondary={t('setup.complete.schedEmbeddingsDesc')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={t('setup.complete.schedAiRecs')}
                secondary={t('setup.complete.schedAiRecsDesc')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={t('setup.complete.schedTopPicks')}
                secondary={t('setup.complete.schedTopPicksDesc')}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Additional Features */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('setup.complete.unlockTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('setup.complete.unlockIntro')}
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <ExtensionIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.featTrakt')}
                secondary={t('setup.complete.featTraktDesc')}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <MovieIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.featMetadata')}
                secondary={t('setup.complete.featMetadataDesc')}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <LiveTvIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.featWatching')}
                secondary={t('setup.complete.featWatchingDesc')}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <PersonIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={t('setup.complete.featUserPrefs')}
                secondary={t('setup.complete.featUserPrefsDesc')}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => goToStep('initialJobs')}>
          {t('setup.complete.backToJobs')}
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={handleCompleteSetup}
          startIcon={<CheckCircleIcon />}
        >
          {t('setup.complete.finishSetup')}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
        {t('setup.complete.finishHint')}
      </Typography>
    </Box>
  )
}
