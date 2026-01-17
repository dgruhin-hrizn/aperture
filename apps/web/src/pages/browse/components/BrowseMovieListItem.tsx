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
  useMediaQuery,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const handleOpenTmdb = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://www.themoviedb.org/movie/${movie.id}`, '_blank')
  }

  const handleRatingClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: { xs: 'none', md: 'translateY(-2px)' },
          boxShadow: { xs: 1, md: 4 },
        },
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex',
          flexGrow: 1,
          alignItems: 'stretch',
          // On mobile, let the action area take full width
          width: { xs: '100%', md: 'auto' },
        }}
      >
        {/* Poster Section - fills card height */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 100, sm: 110, md: 120 },
            alignSelf: 'stretch',
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
        <CardContent
          sx={{
            flexGrow: 1,
            p: { xs: 1.5, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: 0, // Allow text truncation
            '&:last-child': { pb: { xs: 1.5, md: 2 } },
          }}
        >
          <Typography
            variant={isMobile ? 'body1' : 'h6'}
            fontWeight={600}
            noWrap
            mb={0.5}
            sx={{ fontSize: { xs: '0.95rem', md: '1.25rem' } }}
          >
            {movie.title}
          </Typography>

          <Box display="flex" alignItems="center" gap={{ xs: 0.75, md: 1 }} mb={{ xs: 0.5, md: 1 }} flexWrap="wrap">
            {movie.year && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <CalendarTodayIcon sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  {movie.year}
                </Typography>
              </Box>
            )}
            {movie.community_rating && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: { xs: 12, md: 14 }, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  {Number(movie.community_rating).toFixed(1)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Genres - fewer on mobile */}
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={{ xs: 0.5, md: 1 }}>
            {movie.genres.slice(0, isMobile ? 2 : 4).map((genre) => (
              <Chip
                key={genre}
                label={genre}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: { xs: '0.65rem', md: '0.7rem' },
                  height: { xs: 18, md: 22 },
                  '& .MuiChip-label': { px: { xs: 0.75, md: 1 } },
                }}
              />
            ))}
          </Box>

          {/* Overview - single line on mobile, 2 lines on desktop */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: { xs: '0.75rem', md: '0.875rem' },
            }}
          >
            {movie.overview || 'No description available.'}
          </Typography>

          {/* Mobile: Inline actions */}
          {isMobile && (
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mt={1}
              onClick={handleRatingClick}
            >
              <HeartRating
                value={userRating}
                onChange={(rating) => onRate(rating)}
                size="small"
              />
              <Tooltip title="View on TMDb">
                <IconButton
                  onClick={handleOpenTmdb}
                  size="small"
                  sx={{
                    p: 0.5,
                    backgroundColor: alpha(theme.palette.grey[500], 0.1),
                    '&:hover': { backgroundColor: alpha(theme.palette.grey[500], 0.2) },
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Desktop: Actions Panel */}
      {!isMobile && (
        <Box
          sx={{
            width: 140,
            flexShrink: 0,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderLeft: 1,
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
      )}
    </Card>
  )
}
