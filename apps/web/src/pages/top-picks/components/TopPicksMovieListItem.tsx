import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  LinearProgress,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PeopleIcon from '@mui/icons-material/People'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { RankBadge, HeartRating, getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

interface PopularMovie {
  movieId: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  uniqueViewers: number
  playCount: number
  rank: number
}

interface TopPicksMovieListItemProps {
  movie: PopularMovie
  userRating: number | null
  onRate: (rating: number | null) => void
}

export function TopPicksMovieListItem({ movie, userRating, onRate }: TopPicksMovieListItemProps) {
  const navigate = useNavigate()
  const theme = useTheme()

  // Calculate a "popularity score" as a percentage for visual display
  // Normalize based on viewer count (assuming max around 20 viewers is "100%")
  const popularityPercent = Math.min(100, Math.round((movie.uniqueViewers / 10) * 100))

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/movies/${movie.movieId}`)}
        sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}
      >
        {/* Poster Section */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: '100%', md: 100 },
            height: { xs: 200, md: 150 },
            flexShrink: 0,
            overflow: 'hidden',
            bgcolor: 'grey.900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={getProxiedImageUrl(movie.posterUrl)}
            alt={movie.title}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = FALLBACK_POSTER_URL
            }}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <RankBadge rank={movie.rank} size="medium" />
        </Box>

        {/* Content Section */}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" fontWeight={600} noWrap sx={{ mb: 0.5 }}>
            {movie.title}
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {movie.year && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {movie.year}
                </Typography>
              </Box>
            )}
            {movie.communityRating && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary">
                  {movie.communityRating.toFixed(1)}
                </Typography>
              </Box>
            )}
          </Box>
          
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
            {movie.genres.slice(0, 4).map((genre) => (
              <Chip
                key={genre}
                label={genre}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            ))}
          </Box>
          
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {movie.overview || 'No description available.'}
          </Typography>
        </CardContent>
      </CardActionArea>

      {/* Stats & Actions Panel */}
      <Box
        sx={{
          width: { xs: '100%', md: 180 },
          flexShrink: 0,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: { xs: 'stretch', md: 'center' },
          textAlign: 'center',
          borderLeft: { xs: 0, md: 1 },
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
          bgcolor: 'background.default',
          gap: 1.5,
        }}
      >
        {/* Viewer Stats */}
        <Box>
          <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
            <PeopleIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {movie.uniqueViewers}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Unique Viewers
          </Typography>
          <LinearProgress
            variant="determinate"
            value={popularityPercent}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        </Box>

        {/* Play Count */}
        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
          <PlayArrowIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {movie.playCount} plays
          </Typography>
        </Box>

        {/* Actions */}
        <Box display="flex" justifyContent="center" gap={1} alignItems="center">
          <HeartRating
            value={userRating}
            onChange={(rating) => onRate(rating)}
            size="small"
          />
          
          <Tooltip title="View details">
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/movies/${movie.movieId}`)
              }}
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.grey[500], 0.1),
                '&:hover': { backgroundColor: alpha(theme.palette.grey[500], 0.2) },
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Card>
  )
}
