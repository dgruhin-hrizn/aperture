import { Box, Typography, Card, Skeleton, Avatar } from '@mui/material'
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

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

export function RecentWatchesList({ watches, loading }: RecentWatchesListProps) {
  const navigate = useNavigate()

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
        {Array.from({ length: 3 }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Skeleton variant="rounded" width={48} height={72} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="30%" />
            </Box>
          </Box>
        ))}
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {watches.map((item) => (
          <Box
            key={`${item.type}-${item.id}`}
            onClick={() => navigate(`/${item.type === 'movie' ? 'movies' : 'series'}/${item.id}`)}
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
                {item.year || 'Unknown'} • {item.type === 'movie' ? 'Movie' : 'Series'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatRelativeTime(item.lastWatched)}
                {item.playCount > 1 && item.playCount <= 5 && ` · ${item.playCount}x`}
                {item.playCount > 5 && ' · Rewatched'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  )
}

