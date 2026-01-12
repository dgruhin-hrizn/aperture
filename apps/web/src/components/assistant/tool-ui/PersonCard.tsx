/**
 * Person card for Tool UI
 * Shows actor/director with filmography
 */
import { Box, Typography, Avatar, Chip, Link } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { useNavigate } from 'react-router-dom'
import { getProxiedImageUrl } from '@aperture/ui'
import type { Person, PersonResultData } from './types'

interface PersonCardProps {
  person: Person
}

function PersonCardSingle({ person }: PersonCardProps) {
  const navigate = useNavigate()

  const movies = person.filmography.filter(f => f.type === 'movie')
  const series = person.filmography.filter(f => f.type === 'series')

  const roleLabel = {
    actor: 'Actor',
    director: 'Director',
    writer: 'Writer',
  }[person.role]

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: '#1a1a1a',
        borderRadius: 2,
        mb: 1.5,
      }}
    >
      {/* Header with photo */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Avatar
          src={getProxiedImageUrl(person.thumb)}
          sx={{
            width: 64,
            height: 64,
            bgcolor: '#2a2a2a',
          }}
        >
          <PersonIcon />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#fff' }}>
            {person.name}
          </Typography>
          <Chip
            label={roleLabel}
            size="small"
            sx={{
              height: 22,
              mt: 0.5,
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
            }}
          />
        </Box>
      </Box>

      {/* Filmography */}
      {movies.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <MovieIcon sx={{ fontSize: 16, color: '#818cf8' }} />
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Movies ({movies.length})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {movies.slice(0, 8).map((film) => (
              <Chip
                key={film.id}
                label={film.year ? `${film.title} (${film.year})` : film.title}
                size="small"
                onClick={() => navigate(`/movies/${film.id}`)}
                sx={{
                  height: 24,
                  bgcolor: '#2a2a2a',
                  color: '#e4e4e7',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: '#3a3a3a',
                  },
                }}
              />
            ))}
            {movies.length > 8 && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 0.5 }}>
                +{movies.length - 8} more
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {series.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <TvIcon sx={{ fontSize: 16, color: '#10b981' }} />
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              TV Series ({series.length})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {series.slice(0, 8).map((film) => (
              <Chip
                key={film.id}
                label={film.year ? `${film.title} (${film.year})` : film.title}
                size="small"
                onClick={() => navigate(`/series/${film.id}`)}
                sx={{
                  height: 24,
                  bgcolor: '#2a2a2a',
                  color: '#e4e4e7',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: '#3a3a3a',
                  },
                }}
              />
            ))}
            {series.length > 8 && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 0.5 }}>
                +{series.length - 8} more
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

interface PersonResultProps {
  data: PersonResultData
}

export function PersonResult({ data }: PersonResultProps) {
  if (data.error) {
    return (
      <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {data.error}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ my: 2 }}>
      {data.people.map((person, index) => (
        <PersonCardSingle key={`${person.name}-${index}`} person={person} />
      ))}
    </Box>
  )
}


