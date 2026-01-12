import { Box, Typography, Paper } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'
import type { SimilarMovie } from '../types'

interface SimilarMoviesProps {
  similar: SimilarMovie[]
}

export function SimilarMovies({ similar }: SimilarMoviesProps) {
  const navigate = useNavigate()

  if (similar.length === 0) {
    return null
  }

  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Similar Movies
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {similar.map((sim) => (
          <Paper
            key={sim.id}
            onClick={() => navigate(`/movies/${sim.id}`)}
            sx={{
              flexShrink: 0,
              width: 140,
              cursor: 'pointer',
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.05)' },
            }}
          >
            <Box sx={{ height: 200, bgcolor: 'grey.800' }}>
              <Box
                component="img"
                src={getProxiedImageUrl(sim.poster_url)}
                alt={sim.title}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = FALLBACK_POSTER_URL
                }}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
            <Box sx={{ p: 1 }}>
              <Typography variant="caption" fontWeight={500} noWrap>
                {sim.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {sim.year || 'N/A'}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}



