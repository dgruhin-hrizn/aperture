/**
 * Single content item card for Tool UI
 * Compact design with poster, title, and action buttons
 */
import { Box, Typography, Button, Chip, Paper } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import InfoIcon from '@mui/icons-material/Info'
import StarIcon from '@mui/icons-material/Star'
import FavoriteIcon from '@mui/icons-material/Favorite'
import { useNavigate } from 'react-router-dom'
import type { ContentItem } from './types'

interface ContentCardProps {
  item: ContentItem
  onPlay?: (id: string, href: string) => void
}

export function ContentCard({ item, onPlay }: ContentCardProps) {
  const navigate = useNavigate()
  
  const detailsAction = item.actions?.find(a => a.id === 'details')
  const playAction = item.actions?.find(a => a.id === 'play')

  const handleDetails = () => {
    if (detailsAction?.href) {
      navigate(detailsAction.href)
    }
  }

  const handlePlay = () => {
    if (playAction?.href) {
      if (onPlay) {
        onPlay(item.id, playAction.href)
      } else {
        window.open(playAction.href, '_blank')
      }
    }
  }

  return (
    <Paper
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        bgcolor: '#1a1a1a',
        borderRadius: 2,
        minWidth: 280,
        maxWidth: 320,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: '#252525',
          transform: 'translateY(-2px)',
        },
      }}
      onClick={handleDetails}
    >
      {/* Poster */}
      <Box
        sx={{
          width: 60,
          height: 90,
          flexShrink: 0,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#2a2a2a',
          position: 'relative',
        }}
      >
        {item.image ? (
          <Box
            component="img"
            src={item.image}
            alt={item.name}
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
              color: '#666',
              fontSize: 10,
            }}
          >
            No Image
          </Box>
        )}
        {/* Rank badge */}
        {item.rank && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              left: 4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {item.rank}
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="body2"
          fontWeight={600}
          noWrap
          sx={{ color: '#fff' }}
        >
          {item.name}
        </Typography>
        
        {item.subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {item.subtitle}
          </Typography>
        )}

        {/* Ratings row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {item.rating != null && (
            <Chip
              icon={<StarIcon sx={{ fontSize: 12 }} />}
              label={Number(item.rating).toFixed(1)}
              size="small"
              sx={{
                height: 20,
                bgcolor: 'rgba(255, 193, 7, 0.15)',
                color: '#ffc107',
                '& .MuiChip-icon': { color: '#ffc107' },
                '& .MuiChip-label': { px: 0.5, fontSize: 11 },
              }}
            />
          )}
          {item.userRating && (
            <Chip
              icon={<FavoriteIcon sx={{ fontSize: 12 }} />}
              label={item.userRating}
              size="small"
              sx={{
                height: 20,
                bgcolor: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                '& .MuiChip-icon': { color: '#ec4899' },
                '& .MuiChip-label': { px: 0.5, fontSize: 11 },
              }}
            />
          )}
          <Chip
            label={item.type === 'movie' ? 'Movie' : 'Series'}
            size="small"
            sx={{
              height: 20,
              bgcolor: item.type === 'movie' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: item.type === 'movie' ? '#818cf8' : '#10b981',
              '& .MuiChip-label': { px: 0.5, fontSize: 11 },
            }}
          />
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<InfoIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => {
              e.stopPropagation()
              handleDetails()
            }}
            sx={{
              minWidth: 0,
              px: 1,
              py: 0.25,
              fontSize: 11,
              borderColor: '#3a3a3a',
              color: '#a1a1aa',
              '&:hover': {
                borderColor: '#6366f1',
                bgcolor: 'rgba(99, 102, 241, 0.1)',
              },
            }}
          >
            Details
          </Button>
          {playAction && (
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
              onClick={(e) => {
                e.stopPropagation()
                handlePlay()
              }}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.25,
                fontSize: 11,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                },
              }}
            >
              Play
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  )
}

