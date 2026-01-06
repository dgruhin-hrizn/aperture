import { Box, Typography, Paper, Divider, Chip } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import type { Movie } from '../types'
import { formatRuntime } from '../hooks'

interface MovieInfoCardProps {
  movie: Movie
}

export function MovieInfoCard({ movie }: MovieInfoCardProps) {
  return (
    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Movie Info
      </Typography>
      <Divider sx={{ my: 1 }} />
      
      {movie.community_rating && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
          <Typography variant="body2" color="text.secondary">Rating</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="body2" fontWeight={500}>
              {Number(movie.community_rating).toFixed(1)}
            </Typography>
          </Box>
        </Box>
      )}

      {movie.year && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
          <Typography variant="body2" color="text.secondary">Release Year</Typography>
          <Typography variant="body2" fontWeight={500}>{movie.year}</Typography>
        </Box>
      )}

      {movie.runtime_minutes && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
          <Typography variant="body2" color="text.secondary">Runtime</Typography>
          <Typography variant="body2" fontWeight={500}>{formatRuntime(movie.runtime_minutes)}</Typography>
        </Box>
      )}

      {movie.genres && movie.genres.length > 0 && (
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Genres</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {movie.genres.map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}


