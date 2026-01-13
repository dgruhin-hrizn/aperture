import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import TvIcon from '@mui/icons-material/Tv'
import MovieIcon from '@mui/icons-material/Movie'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { Media, MediaServerInfo, WatchStatus } from '../types'
import { isMovie, isSeries } from '../types'
import { formatRuntime } from '../hooks'
import { HeartRating, getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

interface MediaHeroProps {
  media: Media
  mediaServer: MediaServerInfo | null
  userRating: number | null
  ratingLoading?: boolean
  onRatingChange: (rating: number | null) => void
  // Series-specific
  isWatching?: boolean
  onWatchingToggle?: () => void
  // Movie-specific
  watchStatus?: WatchStatus | null
  canManageWatchHistory?: boolean
  userId?: string
  onMarkedUnwatched?: () => void
}

export function MediaHero({
  media,
  mediaServer,
  userRating,
  ratingLoading = false,
  onRatingChange,
  isWatching,
  onWatchingToggle,
  watchStatus,
  canManageWatchHistory,
  userId,
  onMarkedUnwatched,
}: MediaHeroProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handlePlayOnMediaServer = () => {
    if (!mediaServer?.baseUrl || !media.provider_item_id) return

    const webClientUrl = mediaServer.webClientUrl || `${mediaServer.baseUrl}/web/index.html`
    const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
    const itemPath =
      mediaServer.type === 'jellyfin'
        ? `#!/details?id=${media.provider_item_id}${serverIdParam}`
        : `#!/item?id=${media.provider_item_id}${serverIdParam}`

    window.open(`${webClientUrl}${itemPath}`, '_blank')
  }

  const handleMarkUnwatched = async () => {
    if (!userId || !isMovie(media)) return

    setMarking(true)
    try {
      const response = await fetch(`/api/users/${userId}/watch-history/movies/${media.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        setSnackbar({ open: true, message: 'Movie marked as unwatched', severity: 'success' })
        onMarkedUnwatched?.()
      } else {
        const error = await response.json()
        setSnackbar({
          open: true,
          message: error.error || 'Failed to mark as unwatched',
          severity: 'error',
        })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to mark as unwatched', severity: 'error' })
    } finally {
      setMarking(false)
      setConfirmOpen(false)
    }
  }

  // Build year display
  const getYearDisplay = () => {
    if (isSeries(media)) {
      return media.end_year
        ? `${media.year} – ${media.end_year}`
        : media.year
          ? `${media.year} – Present`
          : null
    }
    return media.year
  }

  const yearDisplay = getYearDisplay()

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          flexDirection: { xs: 'column', md: 'row' },
          mt: { xs: -18, md: -28 },
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
          {media.poster_url ? (
            <Box
              component="img"
              src={getProxiedImageUrl(media.poster_url)}
              alt={media.title}
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
              {isMovie(media) ? (
                <MovieIcon sx={{ fontSize: 64, color: 'grey.600' }} />
              ) : (
                <TvIcon sx={{ fontSize: 64, color: 'grey.600' }} />
              )}
            </Box>
          )}
        </Paper>

        {/* Info */}
        <Box sx={{ flex: 1 }}>
          {/* Status badges */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {/* Series status */}
            {isSeries(media) && media.status && (
              <Chip
                label={media.status}
                size="small"
                color={media.status === 'Continuing' ? 'success' : 'default'}
                sx={{ fontWeight: 600 }}
              />
            )}
            {isSeries(media) && media.content_rating && (
              <Chip
                label={media.content_rating}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            {/* Movie availability */}
            {isMovie(media) && (
              <Chip
                label="Available"
                size="small"
                sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 600 }}
              />
            )}
            {/* Movie watch status */}
            {isMovie(media) && watchStatus?.isWatched && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                label={watchStatus.playCount > 1 ? `Watched ${watchStatus.playCount}x` : 'Watched'}
                size="small"
                sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600 }}
              />
            )}
          </Box>

          {/* Title */}
          <Typography
            variant="h3"
            fontWeight={700}
            sx={{ mb: 1, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
          >
            {media.title}
          </Typography>

          {media.original_title && media.original_title !== media.title && (
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
              {media.original_title}
            </Typography>
          )}

          {/* Tagline (series only) */}
          {isSeries(media) && media.tagline && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
              "{media.tagline}"
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
            {/* Movie runtime */}
            {isMovie(media) && media.runtime_minutes && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body1">{formatRuntime(media.runtime_minutes)}</Typography>
              </Box>
            )}
            {/* Series seasons/episodes */}
            {isSeries(media) && media.total_seasons && (
              <Typography variant="body1" color="text.secondary">
                {media.total_seasons} Season{media.total_seasons !== 1 ? 's' : ''}
              </Typography>
            )}
            {isSeries(media) && media.total_episodes && (
              <Typography variant="body1" color="text.secondary">
                {media.total_episodes} Episode{media.total_episodes !== 1 ? 's' : ''}
              </Typography>
            )}
            {/* Series network */}
            {isSeries(media) && media.network && (
              <Chip label={media.network} size="small" variant="outlined" />
            )}
          </Box>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              {media.genres.map((genre) => (
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
              onChange={onRatingChange}
              loading={ratingLoading}
              size="medium"
              showValue
            />
            {/* Series watching toggle */}
            {isSeries(media) && onWatchingToggle && (
              <Tooltip
                title={isWatching ? 'Remove from watching list' : 'Add to watching list'}
              >
                <Button
                  variant={isWatching ? 'contained' : 'outlined'}
                  startIcon={isWatching ? <PlaylistAddCheckIcon /> : <AddToQueueIcon />}
                  onClick={onWatchingToggle}
                  sx={{
                    borderRadius: 2,
                    ...(isWatching && {
                      background:
                        'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
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
            {/* Movie mark unwatched */}
            {isMovie(media) && watchStatus?.isWatched && canManageWatchHistory && (
              <Tooltip title="Mark as unwatched - removes from watch history">
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<VisibilityOffIcon />}
                  onClick={() => setConfirmOpen(true)}
                  sx={{ borderRadius: 2 }}
                >
                  Mark Unwatched
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Community Rating */}
          {media.community_rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ color: 'warning.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  {Number(media.community_rating).toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / 10
                </Typography>
              </Box>
              {/* Series critic rating */}
              {isSeries(media) && media.critic_rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Critic:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {Number(media.critic_rating).toFixed(0)}%
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Overview */}
          {media.overview && (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                lineHeight: 1.7,
                maxWidth: 600,
              }}
            >
              {media.overview}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog for Mark Unwatched */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark as Unwatched?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will mark "{media.title}" as unwatched in your media server and remove it from
            your Aperture watch history.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontWeight: 500, color: 'warning.main' }}>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={marking}>
            Cancel
          </Button>
          <Button onClick={handleMarkUnwatched} color="error" variant="contained" disabled={marking}>
            {marking ? 'Marking...' : 'Mark Unwatched'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </>
  )
}

