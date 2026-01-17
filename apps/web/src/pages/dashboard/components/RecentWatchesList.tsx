import { Box, Typography, Card, Skeleton } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

interface WatchItem {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  lastWatched: Date
  playCount: number
  lastEpisode?: {
    seasonNumber: number
    episodeNumber: number
  }
}

interface RecentWatchesListProps {
  watches: WatchItem[]
  loading?: boolean
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) {
    const remainingMonths = Math.floor((days % 365) / 30)
    if (remainingMonths > 0) return `${years}y ${remainingMonths}mo ago`
    return `${years}y ago`
  }
  if (months > 0) {
    const remainingDays = days % 30
    if (remainingDays > 0) return `${months}mo ${remainingDays}d ago`
    return `${months}mo ago`
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

function WatchItemRow({ item, onClick }: { item: WatchItem; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
    >
      <Box
        component="img"
        src={getProxiedImageUrl(item.posterUrl)}
        alt={item.title}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.src = FALLBACK_POSTER_URL
        }}
        sx={{
          width: 48,
          height: 72,
          objectFit: 'cover',
          borderRadius: 1,
          flexShrink: 0,
          backgroundColor: 'grey.800',
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={500}
          noWrap
          title={item.title}
          sx={{ lineHeight: 1.3 }}
        >
          {item.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {item.year || 'Unknown'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {formatRelativeTime(item.lastWatched)}
          {item.lastEpisode && ` · S${item.lastEpisode.seasonNumber}E${item.lastEpisode.episodeNumber}`}
          {item.type === 'movie' && item.playCount > 1 && item.playCount <= 5 && ` · ${item.playCount}x`}
          {item.type === 'movie' && item.playCount > 5 && ' · Rewatched'}
        </Typography>
      </Box>
    </Box>
  )
}

function ColumnSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <Skeleton variant="rounded" width={48} height={72} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="70%" />
            <Skeleton width="40%" />
            <Skeleton width="50%" />
          </Box>
        </Box>
      ))}
    </>
  )
}

function EmptyColumn({ type }: { type: 'movie' | 'series' }) {
  const Icon = type === 'movie' ? MovieIcon : TvIcon
  return (
    <Box
      sx={{
        py: 3,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Icon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
      <Typography variant="caption" color="text.secondary" display="block">
        No {type === 'movie' ? 'movies' : 'series'} watched yet
      </Typography>
    </Box>
  )
}

export function RecentWatchesList({ watches, loading }: RecentWatchesListProps) {
  const navigate = useNavigate()

  const movies = watches.filter((w) => w.type === 'movie')
  const series = watches.filter((w) => w.type === 'series')

  if (loading) {
    return (
      <Card
        sx={{
          p: 2,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} mb={2}>
          Recently Watched
        </Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MovieIcon sx={{ fontSize: 18 }} /> Movies
            </Typography>
            <ColumnSkeleton />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TvIcon sx={{ fontSize: 18 }} /> Series
            </Typography>
            <ColumnSkeleton />
          </Box>
        </Box>
      </Card>
    )
  }

  if (watches.length === 0) {
    return (
      <Card
        sx={{
          p: 2,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} mb={2}>
          Recently Watched
        </Typography>
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No watch history yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Start watching to see your history here
          </Typography>
        </Box>
      </Card>
    )
  }

  return (
    <Card
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" fontWeight={600} mb={2}>
        Recently Watched
      </Typography>
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Movies Column */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            mb={1.5}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <MovieIcon sx={{ fontSize: 18 }} /> Movies
          </Typography>
          {movies.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {movies.map((item) => (
                <WatchItemRow
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/movies/${item.id}`)}
                />
              ))}
            </Box>
          ) : (
            <EmptyColumn type="movie" />
          )}
        </Box>

        {/* Series Column */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            mb={1.5}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <TvIcon sx={{ fontSize: 18 }} /> Series
          </Typography>
          {series.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {series.map((item) => (
                <WatchItemRow
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/series/${item.id}`)}
                />
              ))}
            </Box>
          ) : (
            <EmptyColumn type="series" />
          )}
        </Box>
      </Box>
    </Card>
  )
}
