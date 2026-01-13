import { Box, Typography, Button, Chip, Paper, Tooltip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import TvIcon from '@mui/icons-material/Tv'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import type { Series, MediaServerInfo } from '../types'
import { HeartRating, getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

interface SeriesHeroProps {
  series: Series
  mediaServer: MediaServerInfo | null
  userRating: number | null
  onRate: (newRating: number) => void
  isWatching?: boolean
  onWatchingToggle?: () => void
}

export function SeriesHero({ series, mediaServer, userRating, onRate, isWatching, onWatchingToggle }: SeriesHeroProps) {
  const handlePlayOnMediaServer = () => {
    if (!mediaServer?.baseUrl || !series.provider_item_id) return

    const webClientUrl = mediaServer.webClientUrl || `${mediaServer.baseUrl}/web/index.html`
    const url = `${webClientUrl}#!/item?id=${series.provider_item_id}&serverId=${mediaServer.serverId}`
    window.open(url, '_blank')
  }

  const yearDisplay = series.end_year
    ? `${series.year} – ${series.end_year}`
    : series.year
      ? `${series.year} – Present`
      : null

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 4,
        flexDirection: { xs: 'column', md: 'row' },
        mt: -20,
        position: 'relative',
        zIndex: 1,
        px: 3,
      }}
    >
      {/* Poster */}
      <Paper
        elevation={8}
        sx={{
          width: { xs: 200, md: 280 },
          height: { xs: 300, md: 420 },
          flexShrink: 0,
          borderRadius: 2,
          overflow: 'hidden',
          alignSelf: { xs: 'center', md: 'flex-start' },
        }}
      >
        {series.poster_url ? (
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
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.800',
            }}
          >
            <TvIcon sx={{ fontSize: 64, color: 'grey.600' }} />
          </Box>
        )}
      </Paper>

      {/* Info */}
      <Box sx={{ flex: 1 }}>
        {/* Status badge */}
        {series.status && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              label={series.status}
              size="small"
              color={series.status === 'Continuing' ? 'success' : 'default'}
              sx={{ fontWeight: 600 }}
            />
            {series.content_rating && (
              <Chip
                label={series.content_rating}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        )}

        {/* Title */}
        <Typography
          variant="h3"
          fontWeight={700}
          sx={{ mb: 1, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
        >
          {series.title}
        </Typography>

        {series.original_title && series.original_title !== series.title && (
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            {series.original_title}
          </Typography>
        )}

        {/* Tagline */}
        {series.tagline && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 2, fontStyle: 'italic' }}
          >
            "{series.tagline}"
          </Typography>
        )}

        {/* Meta row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {yearDisplay && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarTodayIcon fontSize="small" color="action" />
              <Typography variant="body1">{yearDisplay}</Typography>
            </Box>
          )}
          {series.total_seasons && (
            <Typography variant="body1" color="text.secondary">
              {series.total_seasons} Season{series.total_seasons !== 1 ? 's' : ''}
            </Typography>
          )}
          {series.total_episodes && (
            <Typography variant="body1" color="text.secondary">
              {series.total_episodes} Episode{series.total_episodes !== 1 ? 's' : ''}
            </Typography>
          )}
          {series.network && (
            <Chip label={series.network} size="small" variant="outlined" />
          )}
        </Box>

        {/* Genres */}
        {series.genres && series.genres.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            {series.genres.map((genre) => (
              <Chip
                key={genre}
                label={genre}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                }}
              />
            ))}
          </Box>
        )}

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <HeartRating 
            value={userRating} 
            onChange={(rating) => onRate(rating ?? 0)} 
          />
          {onWatchingToggle && (
            <Tooltip title={isWatching ? 'Remove from watching list' : 'Add to watching list'}>
              <Button
                variant={isWatching ? 'contained' : 'outlined'}
                startIcon={isWatching ? <PlaylistAddCheckIcon /> : <AddToQueueIcon />}
                onClick={onWatchingToggle}
                sx={{ 
                  borderRadius: 2,
                  ...(isWatching && {
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
                  }),
                }}
              >
                {isWatching ? 'Watching' : 'Add to Watching'}
              </Button>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={handlePlayOnMediaServer}
            disabled={!mediaServer?.baseUrl}
            sx={{ borderRadius: 2 }}
          >
            {mediaServer?.type === 'jellyfin' ? 'Open in Jellyfin' : 'Open in Emby'}
          </Button>
        </Box>

        {/* Community Rating */}
        {series.community_rating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight={600}>
                {Number(series.community_rating).toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / 10
              </Typography>
            </Box>
            {series.critic_rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Critic:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {Number(series.critic_rating).toFixed(0)}%
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

