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
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import CheckIcon from '@mui/icons-material/Check'
import { getProxiedImageUrl, FALLBACK_POSTER_URL, HeartRating } from '@aperture/ui'

interface Series {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  network: string | null
  status: string | null
  total_seasons: number | null
}

interface BrowseSeriesListItemProps {
  series: Series
  userRating: number | null
  onRate: (rating: number | null) => void
  isWatching: boolean
  onWatchingToggle: () => void
  onClick: () => void
}

export function BrowseSeriesListItem({
  series,
  userRating,
  onRate,
  isWatching,
  onWatchingToggle,
  onClick,
}: BrowseSeriesListItemProps) {
  const theme = useTheme()

  const handleOpenTmdb = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://www.themoviedb.org/tv/${series.id}`, '_blank')
  }

  const handleWatchingClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onWatchingToggle()
  }

  const isAiring = series.status === 'Continuing' || series.status === 'Returning Series'

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
            src={getProxiedImageUrl(series.poster_url)}
            alt={series.title}
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
          {/* Status badge */}
          <Chip
            label={isAiring ? 'Airing' : series.status || 'Ended'}
            size="small"
            color={isAiring ? 'success' : 'default'}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontWeight: 600,
              fontSize: '0.65rem',
              height: 20,
              zIndex: 2,
            }}
          />
          {/* Network badge */}
          {series.network && (
            <Chip
              label={series.network}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: alpha(theme.palette.secondary.main, 0.9),
                color: 'white',
                fontWeight: 600,
                fontSize: '0.6rem',
                height: 20,
                maxWidth: 80,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                zIndex: 2,
              }}
            />
          )}
        </Box>

        {/* Content Section */}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" fontWeight={600} noWrap mb={0.5}>
            {series.title}
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {series.year && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {series.year}
                </Typography>
              </Box>
            )}
            {series.community_rating && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary">
                  {Number(series.community_rating).toFixed(1)}
                </Typography>
              </Box>
            )}
            {series.total_seasons && (
              <Typography variant="body2" color="text.secondary">
                • {series.total_seasons} season{series.total_seasons !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
          
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
            {series.genres.slice(0, 4).map((genre) => (
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
            {series.overview || 'No description available.'}
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
          <Tooltip title={isWatching ? 'Remove from watching' : 'Add to watching'}>
            <IconButton
              onClick={handleWatchingClick}
              size="small"
              sx={{
                backgroundColor: isWatching
                  ? alpha(theme.palette.success.main, 0.1)
                  : alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: isWatching
                    ? alpha(theme.palette.success.main, 0.2)
                    : alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              {isWatching ? <CheckIcon fontSize="small" /> : <AddToQueueIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
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
