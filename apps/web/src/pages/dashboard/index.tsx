import { Box, Typography, Grid, Alert, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
  const { t } = useTranslation()
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

  const greeting = getGreeting(t)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }, 
        justifyContent: 'space-between', 
        gap: { xs: 2, sm: 0 },
        mb: 3 
      }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {greeting}, {user?.displayName || user?.username}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refetch}
          disabled={loading}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          {t('dashboard.refresh')}
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
          title={t('dashboard.aiMovieRecommendations')}
          subtitle={t('dashboard.subtitlePersonalized')}
          items={(data?.recommendations || [])
            .filter(item => item.type === 'movie')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage={t('dashboard.emptyMovieRecs')}
        />
      </Box>

      {/* Your AI Series Recommendations */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title={t('dashboard.aiSeriesRecommendations')}
          subtitle={t('dashboard.subtitlePersonalized')}
          items={(data?.recommendations || [])
            .filter(item => item.type === 'series')
            .map((item, index) => ({ ...item, rank: index + 1 }))}
          loading={loading}
          showScore
          showRank
          emptyMessage={t('dashboard.emptySeriesRecs')}
        />
      </Box>

      {/* Shows You Watch - Upcoming Episodes */}
      {(watchingLoading || upcomingShows.length > 0) && (
        <Box sx={{ mb: 4 }}>
          <WatchingCarousel
            title={t('dashboard.upcomingEpisodes')}
            subtitle={t('dashboard.subtitleFromWatching')}
            items={upcomingShows}
            loading={watchingLoading}
          />
        </Box>
      )}

      {/* Top Pick Movies */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title={t('dashboard.topPickMovies')}
          subtitle={t('dashboard.subtitlePopularMovies')}
          items={(data?.topPicks || []).filter(item => item.type === 'movie')}
          loading={loading}
          showRank
          emptyMessage={t('dashboard.emptyTrendingMovies')}
        />
      </Box>

      {/* Top Pick Series */}
      <Box sx={{ mb: 4 }}>
        <MediaCarousel
          title={t('dashboard.topPickSeries')}
          subtitle={t('dashboard.subtitlePopularSeries')}
          items={(data?.topPicks || []).filter(item => item.type === 'series')}
          loading={loading}
          showRank
          emptyMessage={t('dashboard.emptyTrendingSeries')}
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

function getGreeting(t: TFunction): string {
  const hour = new Date().getHours()
  if (hour < 12) return t('dashboard.greetingMorning')
  if (hour < 17) return t('dashboard.greetingAfternoon')
  return t('dashboard.greetingEvening')
}

