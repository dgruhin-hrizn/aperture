import { Box, Typography, Card, CardContent, Divider, Chip, Avatar, Stack } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import BusinessIcon from '@mui/icons-material/Business'
import CreateIcon from '@mui/icons-material/Create'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import PublicIcon from '@mui/icons-material/Public'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LinkIcon from '@mui/icons-material/Link'
import type { Series } from '../types'

interface SeriesInfoCardProps {
  series: Series
}

export function SeriesInfoCard({ series }: SeriesInfoCardProps) {
  return (
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
  )
}

