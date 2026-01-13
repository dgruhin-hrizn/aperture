import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TvIcon from '@mui/icons-material/Tv'
import { getProxiedImageUrl } from '@aperture/ui'
import type { Episode } from '../types'

interface SeasonsListProps {
  seasons: Record<number, Episode[]>
}

export function SeasonsList({ seasons }: SeasonsListProps) {
  const seasonNumbers = Object.keys(seasons)
    .map(Number)
    .sort((a, b) => a - b)
  const [selectedSeason, setSelectedSeason] = useState(seasonNumbers[0] || 1)
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null)

  if (seasonNumbers.length === 0) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Episodes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No episodes available.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const currentSeasonEpisodes = seasons[selectedSeason] || []

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null
    return `${minutes}m`
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Episodes
        </Typography>

        {/* Season Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={selectedSeason}
            onChange={(_, value) => setSelectedSeason(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minWidth: 80,
                textTransform: 'none',
                fontWeight: 500,
              },
            }}
          >
            {seasonNumbers.map((seasonNum) => (
              <Tab
                key={seasonNum}
                value={seasonNum}
                label={seasonNum === 0 ? 'Specials' : `Season ${seasonNum}`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Episode List */}
        <List disablePadding>
          {currentSeasonEpisodes.map((episode) => (
            <Box key={episode.id}>
              <ListItem
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.default',
                  cursor: episode.overview ? 'pointer' : 'default',
                  '&:hover': episode.overview
                    ? { bgcolor: 'action.hover' }
                    : {},
                }}
                onClick={() => {
                  if (episode.overview) {
                    setExpandedEpisode(
                      expandedEpisode === episode.id ? null : episode.id
                    )
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    variant="rounded"
                    src={getProxiedImageUrl(episode.poster_url)}
                    sx={{
                      width: 80,
                      height: 45,
                      bgcolor: 'grey.800',
                      mr: 1,
                    }}
                  >
                    <TvIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 35 }}>
                        E{episode.episode_number}
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {episode.title}
                      </Typography>
                      {episode.community_rating && (
                        <Chip
                          icon={<StarIcon sx={{ fontSize: 14 }} />}
                          label={Number(episode.community_rating).toFixed(1)}
                          size="small"
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
                            '& .MuiChip-icon': { ml: 0.5, color: 'warning.main' },
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        mt: 0.5,
                        alignItems: 'center',
                      }}
                    >
                      {episode.premiere_date && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(episode.premiere_date)}
                        </Typography>
                      )}
                      {episode.runtime_minutes && (
                        <Typography variant="caption" color="text.secondary">
                          {formatRuntime(episode.runtime_minutes)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                {episode.overview && (
                  <IconButton size="small">
                    {expandedEpisode === episode.id ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                )}
              </ListItem>
              {episode.overview && (
                <Collapse in={expandedEpisode === episode.id}>
                  <Box
                    sx={{
                      px: 2,
                      pb: 2,
                      ml: 12,
                      borderLeft: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {episode.overview}
                    </Typography>
                  </Box>
                </Collapse>
              )}
            </Box>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}

