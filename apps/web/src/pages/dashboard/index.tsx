import { Box, Typography, Grid, Alert, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardData } from './hooks'
import { useWatchingData } from '../watching/hooks/useWatchingData'
import {
  QuickStatsBar,
  MediaCarousel,
  WatchingCarousel,
  RecentRatingsList,
  RecentWatchesList,
} from './components'

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, refetch } = useDashboardData()
  const { series: watchingSeries, loading: watchingLoading } = useWatchingData()

  // Filter watching series to only those with upcoming episodes, sorted by air date
  const upcomingShows = watchingSeries
    .filter((s) => s.upcomingEpisode)
    .sort((a, b) => {
      const dateA = new Date(a.upcomingEpisode!.airDate).getTime()
      const dateB = new Date(b.upcomingEpisode!.airDate).getTime()
      return dateA - dateB
    })

  const greeting = getGreeting()

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {greeting}, {user?.displayName || user?.username}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your media
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refetch}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Quick Stats */}
      <Box sx={{ mb: 4 }}>
        <QuickStatsBar
          moviesWatched={data?.stats.moviesWatched || 0}
          seriesWatched={data?.stats.seriesWatched || 0}
          ratingsCount={data?.stats.ratingsCount || 0}
          watchTimeMinutes={data?.stats.watchTimeMinutes || 0}
          loading={loading}
        />
      </Box>

      {/* Your AI Movie Recommendations */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Your AI Movie Recommendations"
          subtitle="Personalized picks based on your taste"
          items={(data?.recommendations || [])
            .filter(item => item.type === 'movie')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage="No movie recommendations yet. Watch some movies to get personalized picks!"
        />
      </Box>

      {/* Your AI Series Recommendations */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Your AI Series Recommendations"
          subtitle="Personalized picks based on your taste"
          items={(data?.recommendations || [])
            .filter(item => item.type === 'series')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage="No series recommendations yet. Watch some series to get personalized picks!"
        />
      </Box>

      {/* Shows You Watch - Upcoming Episodes */}
      {(watchingLoading || upcomingShows.length > 0) && (
        <Box sx={{ mb: 4 }}>
          <WatchingCarousel
            title="Upcoming Episodes"
            subtitle="From shows you watch"
            items={upcomingShows}
            loading={watchingLoading}
            emptyMessage="No upcoming episodes"
          />
        </Box>
      )}

      {/* Top Pick Movies */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Top Pick Movies"
          subtitle="Popular movies across all users"
          items={(data?.topPicks || []).filter(item => item.type === 'movie')}
          loading={loading}
          showRank
          emptyMessage="No trending movies yet"
        />
      </Box>

      {/* Top Pick Series */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Top Pick Series"
          subtitle="Popular TV series across all users"
          items={(data?.topPicks || []).filter(item => item.type === 'series')}
          loading={loading}
          showRank
          emptyMessage="No trending series yet"
        />
      </Box>

      {/* Bottom section: Recent Watches + Recent Ratings */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <RecentWatchesList
            watches={data?.recentWatches || []}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <RecentRatingsList
            ratings={data?.recentRatings || []}
            loading={loading}
          />
        </Grid>
      </Grid>
    </Box>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

