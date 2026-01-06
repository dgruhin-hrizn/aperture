import { Box, Typography, Grid } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MoviePoster } from '@aperture/ui'
import type { SimilarSeries as SimilarSeriesType } from '../types'

interface SimilarSeriesProps {
  similar: SimilarSeriesType[]
}

export function SimilarSeries({ similar }: SimilarSeriesProps) {
  const navigate = useNavigate()

  if (similar.length === 0) {
    return null
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Similar Series
      </Typography>
      <Grid container spacing={2}>
        {similar.map((show) => (
          <Grid item key={show.id}>
            <MoviePoster
              title={show.title}
              year={show.year}
              posterUrl={show.poster_url}
              genres={show.genres}
              size="small"
              onClick={() => navigate(`/series/${show.id}`)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

