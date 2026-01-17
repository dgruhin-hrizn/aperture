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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // Calculate a "popularity score" as a percentage for visual display
  const popularityPercent = Math.min(100, Math.round((series.uniqueViewers / 10) * 100))

  const handleOpenTmdb = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://www.themoviedb.org/tv/${series.seriesId}`, '_blank')
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
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Main row: Poster + Content + Desktop Stats Panel */}
      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        <CardActionArea
          onClick={() => navigate(`/series/${series.seriesId}`)}
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
            <RankBadge rank={series.rank} size={isMobile ? 'medium' : 'large'} />
            
            {/* Network badge - desktop only */}
            {series.network && !isMobile && (
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
            <Typography
              variant={isMobile ? 'body1' : 'h6'}
              fontWeight={600}
              noWrap
              sx={{ fontSize: { xs: '0.95rem', md: '1.25rem' }, mb: 0.5 }}
            >
              {series.title}
            </Typography>
            
            <Box display="flex" alignItems="center" gap={{ xs: 0.75, md: 1 }} mb={{ xs: 0.5, md: 1 }} flexWrap="wrap">
              {series.year && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CalendarTodayIcon sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {series.year}
                  </Typography>
                </Box>
              )}
              {series.communityRating && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StarIcon sx={{ fontSize: { xs: 12, md: 14 }, color: '#fbbf24' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {series.communityRating.toFixed(1)}
                  </Typography>
                </Box>
              )}
              {series.network && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  • {series.network}
                </Typography>
              )}
            </Box>
            
            <Box display="flex" gap={0.5} flexWrap="wrap" mb={{ xs: 0.5, md: 1 }}>
              {series.genres.slice(0, isMobile ? 2 : 4).map((genre) => (
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
              <PeopleIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
              <Typography variant="body2" fontWeight={700} color="secondary.main">
                {series.uniqueViewers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                viewers
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <TvIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {series.totalEpisodesWatched} eps
              </Typography>
            </Box>
            {series.avgCompletionRate > 0 && (
              <Typography variant="caption" color="text.secondary">
                {Math.round(series.avgCompletionRate * 100)}% avg
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant="determinate"
            value={popularityPercent}
            sx={{
              flex: 1,
              maxWidth: 80,
              height: 4,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.secondary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
              },
            }}
          />
        </Box>
      )}
    </Card>
  )
}
