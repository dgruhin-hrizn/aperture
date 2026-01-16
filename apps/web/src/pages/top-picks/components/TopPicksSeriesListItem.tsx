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
import TvIcon from '@mui/icons-material/Tv'
import { RankBadge, HeartRating, getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

interface PopularSeries {
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  uniqueViewers: number
  totalEpisodesWatched: number
  avgCompletionRate: number
  rank: number
}

interface TopPicksSeriesListItemProps {
  series: PopularSeries
  userRating: number | null
  onRate: (rating: number | null) => void
  isWatching?: boolean
  onWatchingToggle?: () => void
}

export function TopPicksSeriesListItem({ 
  series, 
  userRating, 
  onRate,
}: TopPicksSeriesListItemProps) {
  const navigate = useNavigate()
  const theme = useTheme()

  // Calculate a "popularity score" as a percentage for visual display
  const popularityPercent = Math.min(100, Math.round((series.uniqueViewers / 10) * 100))

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
        onClick={() => navigate(`/series/${series.seriesId}`)}
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
            src={getProxiedImageUrl(series.posterUrl)}
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
          <RankBadge rank={series.rank} size="medium" />
          
          {/* Network badge */}
          {series.network && (
            <Chip
              label={series.network}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: alpha('#8B5CF6', 0.9),
                color: 'white',
                fontWeight: 600,
                fontSize: '0.65rem',
                height: 20,
                maxWidth: 80,
                zIndex: 2,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          )}
        </Box>

        {/* Content Section */}
        <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" fontWeight={600} noWrap sx={{ mb: 0.5 }}>
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
            {series.communityRating && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <StarIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography variant="body2" color="text.secondary">
                  {series.communityRating.toFixed(1)}
                </Typography>
              </Box>
            )}
            {series.network && (
              <Typography variant="body2" color="text.secondary">
                • {series.network}
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
            <PeopleIcon sx={{ fontSize: 24, color: theme.palette.secondary.main }} />
            <Typography variant="h4" fontWeight={700} color="secondary.main">
              {series.uniqueViewers}
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
              backgroundColor: alpha(theme.palette.secondary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
              },
            }}
          />
        </Box>

        {/* Episode Stats */}
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <TvIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {series.totalEpisodesWatched} eps
            </Typography>
          </Box>
          {series.avgCompletionRate > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <PlayArrowIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {Math.round(series.avgCompletionRate * 100)}%
              </Typography>
            </Box>
          )}
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
                navigate(`/series/${series.seriesId}`)
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
