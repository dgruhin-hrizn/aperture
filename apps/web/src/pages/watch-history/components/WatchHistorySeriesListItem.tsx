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
  useMediaQuery,
  LinearProgress,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import TvIcon from '@mui/icons-material/Tv'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import FavoriteIcon from '@mui/icons-material/Favorite'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { getProxiedImageUrl, FALLBACK_POSTER_URL, HeartRating } from '@aperture/ui'

interface SeriesWatchHistoryItem {
  series_id: string
  title: string
  year: number | null
  poster_url: string | null
  genres: string[]
  community_rating: number | null
  overview: string | null
  episodes_watched: number
  total_episodes: number
  total_plays: number
  last_played_at: string | null
  is_favorite: boolean
}

interface WatchHistorySeriesListItemProps {
  series: SeriesWatchHistoryItem
  userRating: number | null
  onRate: (rating: number | null) => void
  canManage?: boolean
  onMarkUnwatched?: () => void
}

export function WatchHistorySeriesListItem({ 
  series, 
  userRating,
  onRate,
  canManage,
  onMarkUnwatched,
}: WatchHistorySeriesListItemProps) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  const progressPercent = series.total_episodes > 0 
    ? Math.min(100, (series.episodes_watched / series.total_episodes) * 100)
    : 0
  
  const isCompleted = series.episodes_watched === series.total_episodes && series.total_episodes > 0

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
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Main row: Poster + Content + Desktop Stats */}
      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        <CardActionArea
          onClick={() => navigate(`/series/${series.series_id}`)}
          sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}
        >
          {/* Poster Section */}
          <Box
            sx={{
              position: 'relative',
              width: { xs: 100, sm: 110, md: 120 },
              alignSelf: 'stretch',
              flexShrink: 0,
              overflow: 'hidden',
              bgcolor: 'grey.900',
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
            
            {/* Completed badge */}
            {isCompleted && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: { xs: 12, md: 14 } }} />}
                label="Complete"
                size="small"
                sx={{
                  position: 'absolute',
                  top: { xs: 4, md: 8 },
                  left: { xs: 4, md: 8 },
                  backgroundColor: alpha('#22c55e', 0.9),
                  color: 'white',
                  fontWeight: 600,
                  fontSize: { xs: '0.55rem', md: '0.65rem' },
                  height: { xs: 18, md: 22 },
                  '& .MuiChip-label': { px: { xs: 0.5, md: 1 } },
                  '& .MuiChip-icon': { color: 'white' },
                  zIndex: 2,
                }}
              />
            )}
            
            {/* Favorite badge */}
            {series.is_favorite && (
              <FavoriteIcon
                sx={{
                  position: 'absolute',
                  top: { xs: 4, md: 8 },
                  right: { xs: 4, md: 8 },
                  color: 'error.main',
                  fontSize: { xs: 16, md: 20 },
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                  zIndex: 2,
                }}
              />
            )}
          </Box>

          {/* Content Section */}
          <CardContent
            sx={{
              flexGrow: 1,
              p: { xs: 1.5, md: 2 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
              '&:last-child': { pb: { xs: 1.5, md: 2 } },
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography
                variant={isMobile ? 'body1' : 'h6'}
                fontWeight={600}
                noWrap
                sx={{ flex: 1, fontSize: { xs: '0.95rem', md: '1.25rem' } }}
              >
                {series.title}
              </Typography>
              {series.is_favorite && !isMobile && (
                <Chip
                  icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                  label="Favorite"
                  size="small"
                  sx={{
                    backgroundColor: alpha('#ef4444', 0.2),
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                />
              )}
            </Box>
            
            <Box display="flex" alignItems="center" gap={{ xs: 0.75, md: 1 }} mb={{ xs: 0.5, md: 1 }} flexWrap="wrap">
              {series.year && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CalendarTodayIcon sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {series.year}
                  </Typography>
                </Box>
              )}
              {series.community_rating && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StarIcon sx={{ fontSize: { xs: 12, md: 14 }, color: '#fbbf24' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {Number(series.community_rating).toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box display="flex" gap={0.5} flexWrap="wrap" mb={{ xs: 0.5, md: 1 }}>
              {series.genres?.slice(0, isMobile ? 2 : 4).map((genre) => (
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
              {series.overview || 'No description available.'}
            </Typography>

            {/* Mobile: Inline actions */}
            {isMobile && (
              <Box display="flex" alignItems="center" gap={1} mt={1} onClick={handleRatingClick}>
                <HeartRating
                  value={userRating}
                  onChange={(rating) => onRate(rating)}
                  size="small"
                />
                <Tooltip title="View details">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/series/${series.series_id}`)
                    }}
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
                {canManage && onMarkUnwatched && (
                  <Tooltip title="Mark all episodes as unwatched">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarkUnwatched()
                      }}
                      size="small"
                      sx={{
                        p: 0.5,
                        backgroundColor: alpha(theme.palette.error.main, 0.1),
                        '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.2) },
                      }}
                    >
                      <VisibilityOffIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </CardContent>
        </CardActionArea>

        {/* Desktop: Stats & Actions Panel */}
        {!isMobile && (
          <Box
            sx={{
              width: 180,
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
            {/* Progress */}
            <Box>
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <TvIcon sx={{ fontSize: 20, color: isCompleted ? '#22c55e' : theme.palette.secondary.main }} />
                <Typography 
                  variant="h5" 
                  fontWeight={700} 
                  color={isCompleted ? '#22c55e' : 'secondary.main'}
                >
                  {Math.round(progressPercent)}%
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {series.episodes_watched} / {series.total_episodes} episodes
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: alpha(isCompleted ? '#22c55e' : theme.palette.secondary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: isCompleted 
                      ? '#22c55e'
                      : `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                  },
                }}
              />
            </Box>

            {/* Last Watched */}
            <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatDate(series.last_played_at)}
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
                    navigate(`/series/${series.series_id}`)
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
              
              {canManage && onMarkUnwatched && (
                <Tooltip title="Mark all episodes as unwatched">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation()
                      onMarkUnwatched()
                    }}
                    size="small"
                    sx={{
                      backgroundColor: alpha(theme.palette.error.main, 0.1),
                      '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.2) },
                    }}
                  >
                    <VisibilityOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Mobile: Full-width Stats Section */}
      {isMobile && (
        <Box
          sx={{
            p: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <TvIcon sx={{ fontSize: 16, color: isCompleted ? '#22c55e' : theme.palette.secondary.main }} />
              <Typography 
                variant="body2" 
                fontWeight={700} 
                color={isCompleted ? '#22c55e' : 'secondary.main'}
              >
                {Math.round(progressPercent)}%
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {series.episodes_watched}/{series.total_episodes} eps
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {formatDate(series.last_played_at)}
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              flex: 1,
              maxWidth: 80,
              height: 4,
              borderRadius: 2,
              backgroundColor: alpha(isCompleted ? '#22c55e' : theme.palette.secondary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: isCompleted 
                  ? '#22c55e'
                  : `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
              },
            }}
          />
        </Box>
      )}
    </Card>
  )
}
