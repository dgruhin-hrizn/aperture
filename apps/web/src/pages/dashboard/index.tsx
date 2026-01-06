import { Box, Typography, Grid, Alert, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardData } from './hooks'
import {
  QuickStatsBar,
  MediaCarousel,
  RecentRatingsList,
  RecentWatchesList,
} from './components'

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, refetch } = useDashboardData()

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

      {/* Your Movie Picks */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Your Movie Picks"
          subtitle="AI-powered movie recommendations"
          items={(data?.recommendations || [])
            .filter(item => item.type === 'movie')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage="No movie recommendations yet. Watch some movies to get personalized picks!"
        />
      </Box>

      {/* Your Series Picks */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Your Series Picks"
          subtitle="AI-powered series recommendations"
          items={(data?.recommendations || [])
            .filter(item => item.type === 'series')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage="No series recommendations yet. Watch some series to get personalized picks!"
        />
      </Box>

      {/* Trending Movies */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Trending Movies"
          subtitle="Popular movies across all users"
          items={(data?.topPicks || []).filter(item => item.type === 'movie')}
          loading={loading}
          showRank
          emptyMessage="No trending movies yet"
        />
      </Box>

      {/* Trending Series */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title="Trending Series"
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

