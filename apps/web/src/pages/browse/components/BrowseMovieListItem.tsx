import React from 'react'
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
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { getProxiedImageUrl, FALLBACK_POSTER_URL, HeartRating } from '@aperture/ui'

interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
}

interface BrowseMovieListItemProps {
  movie: Movie
  userRating: number | null
  onRate: (rating: number | null) => void
  onClick: () => void
}

export function BrowseMovieListItem({
  movie,
  userRating,
  onRate,
  onClick,
}: BrowseMovieListItemProps) {
  const theme = useTheme()

  const handleOpenTmdb = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://www.themoviedb.org/movie/${movie.id}`, '_blank')
  }

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
        onClick={onClick}
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
            src={getProxiedImageUrl(movie.poster_url)}
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
        </Box>

        {/* Content Section */}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" fontWeight={600} noWrap mb={0.5}>
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
            {movie.community_rating && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary">
                  {Number(movie.community_rating).toFixed(1)}
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

      {/* Actions Panel */}
      <Box
        sx={{
          width: { xs: '100%', md: 140 },
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
        {/* User Rating */}
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Your Rating
          </Typography>
          <HeartRating
            value={userRating}
            onChange={(rating) => onRate(rating)}
            size="small"
          />
        </Box>

        {/* Actions */}
        <Box display="flex" justifyContent="center" gap={1}>
          <Tooltip title="View on TMDb">
            <IconButton
              onClick={handleOpenTmdb}
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
