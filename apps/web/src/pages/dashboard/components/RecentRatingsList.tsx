import { Box, Typography, Card, Skeleton, Avatar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FavoriteIcon from '@mui/icons-material/Favorite'

interface RatingItem {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  rating: number
  ratedAt: Date
}

interface RecentRatingsListProps {
  ratings: RatingItem[]
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

function HeartDisplay({ rating }: { rating: number }) {
  // Show filled hearts for the rating (max 10)
  const filledHearts = Math.min(rating, 10)
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {Array.from({ length: filledHearts }).map((_, i) => (
        <FavoriteIcon
          key={i}
          sx={{
            fontSize: 14,
            color: '#ec4899',
          }}
        />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
        {rating}/10
      </Typography>
    </Box>
  )
}

export function RecentRatingsList({ ratings, loading }: RecentRatingsListProps) {
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
          Recent Ratings
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

  if (ratings.length === 0) {
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
          Recent Ratings
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
          <FavoriteIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No ratings yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rate movies and series to see them here
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
        Recent Ratings
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {ratings.map((item) => (
          <Box
            key={item.id}
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
            {item.posterUrl ? (
              <Box
                component="img"
                src={item.posterUrl}
                alt={item.title}
                sx={{
                  width: 48,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
            ) : (
              <Avatar
                variant="rounded"
                sx={{
                  width: 48,
                  height: 72,
                  backgroundColor: 'grey.800',
                }}
              >
                {item.type === 'movie' ? <MovieIcon /> : <TvIcon />}
              </Avatar>
            )}
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                <HeartDisplay rating={item.rating} />
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(item.ratedAt)}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  )
}


