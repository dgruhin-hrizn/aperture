import { Box, Typography, Card, CardContent, Divider, Chip, Avatar, Stack, Tooltip, Paper } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import BusinessIcon from '@mui/icons-material/Business'
import CreateIcon from '@mui/icons-material/Create'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import PublicIcon from '@mui/icons-material/Public'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LinkIcon from '@mui/icons-material/Link'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import type { Series } from '../types'

interface SeriesInfoCardProps {
  series: Series
}

// Rotten Tomatoes score badge component
function RTScoreBadge({ score, type }: { score: number; type: 'critic' | 'audience' }) {
  const isFresh = score >= 60
  const icon = type === 'critic' ? '🍅' : '🍿'
  const label = type === 'critic' ? 'Tomatometer' : 'Audience'
  
  return (
    <Tooltip title={`${label}: ${score}%`}>
      <Box sx={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: 0.5,
        bgcolor: isFresh ? 'success.main' : 'error.main',
        color: 'white',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}>
        <span>{icon}</span>
        <span>{score}%</span>
      </Box>
    </Tooltip>
  )
}

// Metacritic score badge
function MetacriticBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 75) return '#66cc33'
    if (score >= 50) return '#ffcc33'
    return '#ff0000'
  }
  
  return (
    <Tooltip title={`Metacritic: ${score}/100`}>
      <Box sx={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: getColor(),
        color: score >= 50 ? 'black' : 'white',
        width: 28,
        height: 28,
        borderRadius: 0.5,
        fontSize: '0.75rem',
        fontWeight: 700,
      }}>
        {score}
      </Box>
    </Tooltip>
  )
}

export function SeriesInfoCard({ series }: SeriesInfoCardProps) {
  const hasRatings = series.rt_critic_score || series.rt_audience_score || series.metacritic_score

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Critic Ratings Section */}
      {hasRatings && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Critic Ratings
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {series.rt_critic_score && (
              <RTScoreBadge score={series.rt_critic_score} type="critic" />
            )}
            {series.rt_audience_score && (
              <RTScoreBadge score={series.rt_audience_score} type="audience" />
            )}
            {series.metacritic_score && (
              <MetacriticBadge score={series.metacritic_score} />
            )}
          </Box>
          {series.rt_consensus && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}
            >
              "{series.rt_consensus}"
            </Typography>
          )}
        </Paper>
      )}

      {/* Awards Section (from OMDb enrichment) */}
      {series.awards_summary && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500}>
              {series.awards_summary}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Keywords Section */}
      {series.keywords && series.keywords.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <LocalOfferIcon fontSize="small" />
            Keywords
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {series.keywords.slice(0, 10).map((keyword) => (
              <Chip 
                key={keyword} 
                label={keyword} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          {/* Overview */}
          {series.overview && (
          <>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Overview
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
              {series.overview}
            </Typography>
          </>
        )}

        {/* Cast */}
        {series.actors && series.actors.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="h6"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <PersonIcon fontSize="small" />
              Cast
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              {series.actors.slice(0, 12).map((actor, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={actor.thumb}
                    sx={{ width: 40, height: 40, bgcolor: 'grey.700' }}
                  >
                    <PersonIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {actor.name}
                    </Typography>
                    {actor.role && (
                      <Typography variant="caption" color="text.secondary">
                        {actor.role}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Creators / Directors */}
        {series.directors && series.directors.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <MovieFilterIcon fontSize="small" />
              Created By
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {series.directors.map((director) => (
                <Chip key={director} label={director} size="small" variant="outlined" />
              ))}
            </Stack>
          </>
        )}

        {/* Writers */}
        {series.writers && series.writers.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <CreateIcon fontSize="small" />
              Writers
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {series.writers.slice(0, 10).map((writer) => (
                <Chip key={writer} label={writer} size="small" variant="outlined" />
              ))}
            </Stack>
          </>
        )}

        {/* Studios */}
        {series.studios && series.studios.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <BusinessIcon fontSize="small" />
              Studios
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {series.studios.map((studio, idx) => {
                const studioName = typeof studio === 'string' ? studio : studio.name
                return (
                  <Chip key={`${studioName}-${idx}`} label={studioName} size="small" variant="outlined" />
                )
              })}
            </Stack>
          </>
        )}

        {/* Production Countries */}
        {series.production_countries && series.production_countries.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <PublicIcon fontSize="small" />
              Countries
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {series.production_countries.map((country) => (
                <Chip key={country} label={country} size="small" variant="outlined" />
              ))}
            </Stack>
          </>
        )}

        {/* Awards */}
        {series.awards && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <EmojiEventsIcon fontSize="small" />
              Awards
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {series.awards}
            </Typography>
          </>
        )}

        {/* External Links */}
        {(series.imdb_id || series.tmdb_id || series.tvdb_id) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle1"
              fontWeight={600}
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <LinkIcon fontSize="small" />
              External Links
            </Typography>
            <Stack direction="row" gap={1}>
              {series.imdb_id && (
                <Chip
                  label="IMDb"
                  size="small"
                  component="a"
                  href={`https://www.imdb.com/title/${series.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  sx={{ fontWeight: 600 }}
                />
              )}
              {series.tmdb_id && (
                <Chip
                  label="TMDb"
                  size="small"
                  component="a"
                  href={`https://www.themoviedb.org/tv/${series.tmdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                />
              )}
              {series.tvdb_id && (
                <Chip
                  label="TVDb"
                  size="small"
                  component="a"
                  href={`https://thetvdb.com/?id=${series.tvdb_id}&tab=series`}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                />
              )}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
    </Box>
  )
}

