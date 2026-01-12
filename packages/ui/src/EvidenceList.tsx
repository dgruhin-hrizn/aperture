import React from 'react'
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Chip,
} from '@mui/material'
import Movie from '@mui/icons-material/Movie'
import Favorite from '@mui/icons-material/Favorite'
import PlayArrow from '@mui/icons-material/PlayArrow'
import ThumbUp from '@mui/icons-material/ThumbUp'
import { getProxiedImageUrl } from './imageUtils.js'

// Type workaround for MUI icons with NodeNext module resolution
type IconComponent = React.ComponentType<{ fontSize?: string }>
const MovieIcon = Movie as unknown as IconComponent
const FavoriteIcon = Favorite as unknown as IconComponent
const PlayArrowIcon = PlayArrow as unknown as IconComponent
const ThumbUpIcon = ThumbUp as unknown as IconComponent

export interface EvidenceItem {
  movieId: string
  title: string
  year?: number | null
  posterUrl?: string | null
  similarity: number
  evidenceType: 'watched' | 'favorite' | 'highly_rated' | 'recent'
}

export interface EvidenceListProps {
  title?: string
  evidence: EvidenceItem[]
  onMovieClick?: (movieId: string) => void
}

const evidenceTypeConfig = {
  watched: {
    label: 'Watched',
    icon: <PlayArrowIcon fontSize="small" />,
    color: 'default' as const,
  },
  favorite: {
    label: 'Favorite',
    icon: <FavoriteIcon fontSize="small" />,
    color: 'error' as const,
  },
  highly_rated: {
    label: 'Highly Rated',
    icon: <ThumbUpIcon fontSize="small" />,
    color: 'success' as const,
  },
  recent: {
    label: 'Recent',
    icon: <PlayArrowIcon fontSize="small" />,
    color: 'info' as const,
  },
}

export function EvidenceList({
  title = 'Why This Was Recommended',
  evidence,
  onMovieClick,
}: EvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <Paper sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No evidence available for this recommendation.
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={1}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Based on your viewing history, this movie is similar to:
      </Typography>

      <List disablePadding>
        {evidence.map((item, index) => {
          const config = evidenceTypeConfig[item.evidenceType]

          return (
            <ListItem
              key={`${item.movieId}-${index}`}
              sx={{
                px: 0,
                cursor: onMovieClick ? 'pointer' : 'default',
                '&:hover': onMovieClick
                  ? {
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                    }
                  : {},
              }}
              onClick={() => onMovieClick?.(item.movieId)}
            >
              <ListItemAvatar>
                {item.posterUrl ? (
                  <Avatar
                    src={getProxiedImageUrl(item.posterUrl)}
                    variant="rounded"
                    sx={{ width: 48, height: 72 }}
                  />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 48, height: 72, bgcolor: 'grey.800' }}>
                    <MovieIcon />
                  </Avatar>
                )}
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={500}>
                      {item.title}
                    </Typography>
                    {item.year && (
                      <Typography variant="caption" color="text.secondary">
                        ({item.year})
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                    <Chip
                      icon={config.icon}
                      label={config.label}
                      size="small"
                      color={config.color}
                      variant="outlined"
                      sx={{ height: 24 }}
                    />
                    <Typography variant="caption" color="primary.main" fontWeight={500}>
                      {(item.similarity * 100).toFixed(0)}% similar
                    </Typography>
                  </Box>
                }
                sx={{ ml: 1 }}
              />
            </ListItem>
          )
        })}
      </List>
    </Paper>
  )
}

