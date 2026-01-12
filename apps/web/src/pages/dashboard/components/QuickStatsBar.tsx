import { Box, Card, Typography, Skeleton } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

interface QuickStatsBarProps {
  moviesWatched: number
  seriesWatched: number
  ratingsCount: number
  watchTimeMinutes: number
  loading?: boolean
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  loading?: boolean
}

function StatCard({ icon, label, value, color, loading }: StatCardProps) {
  return (
    <Card
      sx={{
        flex: { xs: '1 1 calc(50% - 8px)', sm: 1 },
        minWidth: { xs: 0, sm: 140 },
        p: { xs: 1.5, sm: 2 },
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}20`,
          color: color,
        }}
      >
        {icon}
      </Box>
      <Box>
        {loading ? (
          <>
            <Skeleton width={60} height={28} />
            <Skeleton width={80} height={16} />
          </>
        ) : (
          <>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </>
        )}
      </Box>
    </Card>
  )
}

function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function QuickStatsBar({
  moviesWatched,
  seriesWatched,
  ratingsCount,
  watchTimeMinutes,
  loading,
}: QuickStatsBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        overflowX: { xs: 'visible', sm: 'auto' },
        pb: 1,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { 
          backgroundColor: 'divider',
          borderRadius: 3,
        },
      }}
    >
      <StatCard
        icon={<MovieIcon />}
        label="Movies Watched"
        value={moviesWatched.toLocaleString()}
        color="#6366f1"
        loading={loading}
      />
      <StatCard
        icon={<TvIcon />}
        label="Series Watched"
        value={seriesWatched.toLocaleString()}
        color="#8b5cf6"
        loading={loading}
      />
      <StatCard
        icon={<FavoriteIcon />}
        label="Ratings"
        value={ratingsCount.toLocaleString()}
        color="#ec4899"
        loading={loading}
      />
      <StatCard
        icon={<AccessTimeIcon />}
        label="Watch Time"
        value={formatWatchTime(watchTimeMinutes)}
        color="#10b981"
        loading={loading}
      />
    </Box>
  )
}


