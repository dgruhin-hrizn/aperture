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
import type { SetupWizardContext, UserLibraryResult } from '../types'

interface CompleteStepProps {
  wizard: SetupWizardContext
}

function LibrarySummarySection({ 
  type, 
  users, 
  icon 
}: { 
  type: 'Movies' | 'TV Series'
  users: UserLibraryResult[]
  icon: React.ReactNode 
}) {
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
          {type}
        </Typography>
        <Chip 
          label={`${totalRecs} recommendations`} 
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
              primary={user.libraryName || `${user.displayName}'s AI Picks`}
              secondary={`${user.recommendationCount} recommendations`}
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
              secondary={user.error || 'Skipped (no watch history)'}
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
              secondary={user.error || 'Failed'}
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
  if (moviesCount === 0 && seriesCount === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TrendingUpIcon fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight={600}>
          Top Picks (Global)
        </Typography>
      </Box>
      
      <List dense disablePadding>
        {moviesCount > 0 && (
          <ListItem sx={{ py: 0.5, px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Top Picks - Movies"
              secondary={`${moviesCount} popular movies`}
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
              primary="Top Picks - Series"
              secondary={`${seriesCount} popular series`}
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
  const { handleCompleteSetup, jobsProgress, serverName, serverType, goToStep } = wizard

  // Extract library results from completed sync jobs
  const movieSyncJob = jobsProgress.find((j) => j.id === 'sync-movie-libraries')
  const seriesSyncJob = jobsProgress.find((j) => j.id === 'sync-series-libraries')
  const topPicksJob = jobsProgress.find((j) => j.id === 'sync-top-picks')
  
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

  return (
    <Box>
      {/* Success Header */}
      <Box textAlign="center" sx={{ mb: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Setup Complete!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aperture has created personalized recommendation libraries in your media server.
        </Typography>
      </Box>

      {/* Issues Alert */}
      {hasAnyIssues && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Some users were skipped or had issues. Users need watch history for recommendations to be generated.
            They will receive recommendations after watching more content and running the next sync.
          </Typography>
        </Alert>
      )}

      {/* Created Libraries Summary */}
      {hasAnyLibraries && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon color="primary" />
              <Typography variant="h6">
                Libraries Created in {serverName || serverType || 'Media Server'}
              </Typography>
            </Box>
            
            <LibrarySummarySection
              type="Movies"
              users={movieUsers}
              icon={<MovieIcon fontSize="small" color="primary" />}
            />
            
            {hasMovieLibraries && hasSeriesLibraries && <Divider sx={{ my: 2 }} />}
            
            <LibrarySummarySection
              type="TV Series"
              users={seriesUsers}
              icon={<TvIcon fontSize="small" color="primary" />}
            />
            
            {(hasMovieLibraries || hasSeriesLibraries) && hasTopPicks && <Divider sx={{ my: 2 }} />}
            
            <TopPicksSummarySection
              moviesCount={topPicksMoviesCount}
              seriesCount={topPicksSeriesCount}
            />
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      <Card variant="outlined" sx={{ mb: 3, backgroundColor: 'action.hover' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Getting Started
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <LoginIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Log in with your Media Server admin credentials"
                secondary="Use the same username and password you use for Emby/Jellyfin"
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <OpenInNewIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Open your media server to see the new libraries"
                secondary="New 'AI Picks' libraries will appear for each enabled user in Aperture"
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <ScheduleIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Recommendations refresh automatically"
                secondary="Aperture syncs daily to update recommendations based on new watch history. You can adjust scheduling in the Admin area."
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Additional Features */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Unlock More Features
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            After logging in, visit <strong>Admin → Settings</strong> to enable these additional features:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <ExtensionIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="Trakt Integration"
                secondary="Connect your Trakt account to import ratings, watchlists, and discover trending content"
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <MovieIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="TMDb & OMDb Metadata"
                secondary="Enrich your library with additional metadata, ratings, and artwork from TMDb and OMDb"
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <LiveTvIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="Shows You Watch – Virtual DVR"
                secondary="Automatically create a library of shows you're currently watching, perfect for catching up on your favorites, and ignoring other shows you're not interested in with new episodes."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <PersonIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="User Preferences"
                secondary="Each user can customize their recommendation preferences and settings"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => goToStep('initialJobs')}>
          Back to Jobs
        </Button>
        <Button 
          variant="contained" 
          size="large" 
          onClick={handleCompleteSetup}
          startIcon={<CheckCircleIcon />}
        >
          Finish Setup
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
        Clicking Finish will disable the public setup wizard, secure Aperture, and redirect to login.
      </Typography>
    </Box>
  )
}

