import { Box, Typography, Button, Chip, Paper, IconButton } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import type { Movie, MediaServerInfo } from '../types'
import { formatRuntime } from '../hooks'

interface MovieHeroProps {
  movie: Movie
  mediaServer: MediaServerInfo | null
}

export function MovieHero({ movie, mediaServer }: MovieHeroProps) {
  const handlePlayOnEmby = () => {
    if (!mediaServer?.baseUrl || !movie?.provider_item_id) {
      return
    }

    // Open the item in the media server's web client
    // For Emby: /web/index.html#!/item?id=ITEM_ID&serverId=SERVER_ID
    // For Jellyfin: /web/index.html#!/details?id=ITEM_ID&serverId=SERVER_ID
    const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
    const itemPath = mediaServer.type === 'jellyfin'
      ? `#!/details?id=${movie.provider_item_id}${serverIdParam}`
      : `#!/item?id=${movie.provider_item_id}${serverIdParam}`

    window.open(`${mediaServer.baseUrl}/web/index.html${itemPath}`, '_blank')
  }

  return (
    <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' }, mt: -20, position: 'relative', zIndex: 1, px: 3 }}>
      {/* Poster */}
      <Box sx={{ flexShrink: 0 }}>
        <Paper
          elevation={8}
          sx={{
            width: { xs: 150, md: 220 },
            height: { xs: 225, md: 330 },
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'grey.900',
          }}
        >
          {movie.poster_url ? (
            <Box
              component="img"
              src={movie.poster_url}
              alt={movie.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              <Typography variant="body2" color="text.secondary" textAlign="center" p={2}>
                {movie.title}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1 }}>
        {/* Status badge */}
        <Chip
          label="Available"
          size="small"
          sx={{
            bgcolor: 'success.main',
            color: 'white',
            fontWeight: 600,
            mb: 1,
          }}
        />

        {/* Title */}
        <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
          {movie.title}
          {movie.year && (
            <Typography component="span" variant="h4" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
              ({movie.year})
            </Typography>
          )}
        </Typography>

        {/* Meta row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {movie.genres && movie.genres.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {movie.genres.join(' • ')}
            </Typography>
          )}
          {movie.runtime_minutes && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatRuntime(movie.runtime_minutes)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <IconButton
            sx={{
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <StarBorderIcon />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={handlePlayOnEmby}
            disabled={!mediaServer?.baseUrl}
            sx={{ borderRadius: 2 }}
          >
            {mediaServer?.type === 'jellyfin' ? 'Play on Jellyfin' : 'Play on Emby'}
          </Button>
        </Box>

        {/* Rating */}
        {movie.community_rating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight={600}>
                {Number(movie.community_rating).toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / 10
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

