import { useState, useEffect } from 'react'
import {
  Card,
  CardActionArea,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Skeleton,
  alpha,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import HubIcon from '@mui/icons-material/Hub'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { getProxiedImageUrl } from '@aperture/ui'
import type { GraphPlaylist } from '../types'

interface GraphPlaylistItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  type: 'movie' | 'series'
}

interface GraphPlaylistCardProps {
  playlist: GraphPlaylist
  onDelete: (playlistId: string, playlistName: string) => void
  onView?: (playlist: GraphPlaylist) => void
}

export function GraphPlaylistCard({ playlist, onDelete, onView }: GraphPlaylistCardProps) {
  const [previewItems, setPreviewItems] = useState<GraphPlaylistItem[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Fetch preview items when the card mounts
  useEffect(() => {
    const fetchPreview = async () => {
      setLoadingPreview(true)
      try {
        const response = await fetch(`/api/graph-playlists/${playlist.id}/items`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setPreviewItems((data.items || []).slice(0, 5))
        }
      } catch {
        // Silent fail - preview is nice to have
      } finally {
        setLoadingPreview(false)
      }
    }

    fetchPreview()
  }, [playlist.id])

  const handleCardClick = () => {
    onView?.(playlist)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(playlist.id, playlist.name)
  }

  const isClickable = !!onView

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: isClickable ? 'translateY(-4px)' : 'none',
          boxShadow: isClickable ? 8 : 1,
        },
      }}
    >
      {/* Graph Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          bgcolor: 'primary.main',
          borderRadius: 1.5,
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          zIndex: 2,
        }}
      >
        <HubIcon sx={{ fontSize: 14, color: 'white' }} />
        <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.65rem' }}>
          Similarity
        </Typography>
      </Box>

      {/* Poster Preview Header */}
      <CardActionArea
        onClick={handleCardClick}
        disabled={!isClickable}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box
          sx={{
            height: 140,
            position: 'relative',
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(theme.palette.primary.dark, 0.2)} 100%)`,
            overflow: 'hidden',
          }}
        >
          {loadingPreview ? (
            <Box display="flex" gap={0.5} p={1} height="100%">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  sx={{
                    flex: 1,
                    height: '100%',
                    borderRadius: 1,
                  }}
                />
              ))}
            </Box>
          ) : previewItems.length > 0 ? (
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                p: 1,
                height: '100%',
              }}
            >
              {previewItems.map((item, index) => (
                <Box
                  key={item.id}
                  sx={{
                    flex: 1,
                    height: '100%',
                    borderRadius: 1,
                    overflow: 'hidden',
                    position: 'relative',
                    opacity: 1 - index * 0.05,
                  }}
                >
                  {item.posterUrl ? (
                    <Box
                      component="img"
                      src={getProxiedImageUrl(item.posterUrl)}
                      alt={item.title}
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
                        bgcolor: 'action.hover',
                      }}
                    >
                      {item.type === 'series' ? (
                        <TvIcon sx={{ color: 'text.disabled' }} />
                      ) : (
                        <MovieIcon sx={{ color: 'text.disabled' }} />
                      )}
                    </Box>
                  )}
                </Box>
              ))}
              {/* Show more indicator */}
              {playlist.itemCount > 5 && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  +{playlist.itemCount - 5} more
                </Box>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                pt: 2,
              }}
            >
              <HubIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled">
                Loading items...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ p: 2, flexGrow: 1 }}>
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
            <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, pr: 1 }}>
              {playlist.name}
            </Typography>
            <Chip
              icon={playlist.sourceItemType === 'series' ? <TvIcon /> : <MovieIcon />}
              label={`${playlist.itemCount}`}
              size="small"
              sx={{
                bgcolor: 'action.selected',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 22,
                '& .MuiChip-icon': { fontSize: 14 },
              }}
            />
          </Box>

          {playlist.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                mb: 1,
                lineHeight: 1.4,
              }}
            >
              {playlist.description}
            </Typography>
          )}
        </Box>
      </CardActionArea>

      {/* Action Bar */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Created {new Date(playlist.createdAt).toLocaleDateString()}
        </Typography>

        <Box display="flex" gap={0.5}>
          {isClickable && (
            <Tooltip title="View playlist">
              <IconButton size="small" onClick={handleCardClick} color="primary">
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete playlist">
            <IconButton size="small" onClick={handleDeleteClick} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Card>
  )
}
