import { useCallback } from 'react'
import { Box, Typography, Grid } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../../../hooks/useUserRatings'
import type { SimilarSeries as SimilarSeriesType } from '../types'

interface SimilarSeriesProps {
  similar: SimilarSeriesType[]
}

export function SimilarSeries({ similar }: SimilarSeriesProps) {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()

  const handleRate = useCallback(
    async (seriesId: string, rating: number | null) => {
      try {
        await setRating('series', seriesId, rating)
      } catch (err) {
        console.error('Failed to rate series:', err)
      }
    },
    [setRating]
  )

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
              userRating={getRating('series', show.id)}
              onRate={(rating) => handleRate(show.id, rating)}
              size="small"
              onClick={() => navigate(`/series/${show.id}`)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

