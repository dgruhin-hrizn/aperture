import { useState } from 'react'
import { Box, IconButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getProxiedImageUrl } from '@aperture/ui'

interface MovieBackdropProps {
  backdropUrl: string | null
  title: string
  onBack: () => void
}

export function MovieBackdrop({ backdropUrl, title, onBack }: MovieBackdropProps) {
  const [imageError, setImageError] = useState(false)
  const proxiedBackdropUrl = backdropUrl ? getProxiedImageUrl(backdropUrl, '') : null

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 300, md: 450 },
        mx: -3,
        mt: -3,
        mb: 3,
        overflow: 'hidden',
      }}
    >
      {proxiedBackdropUrl && !imageError ? (
        <Box
          component="img"
          src={proxiedBackdropUrl}
          alt={title}
          onError={() => setImageError(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.6)',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          }}
        />
      )}

      {/* Gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60%',
          background: 'linear-gradient(to top, rgba(18,18,18,1) 0%, rgba(18,18,18,0) 100%)',
        }}
      />

      {/* Back button */}
      <IconButton
        onClick={onBack}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          bgcolor: 'rgba(0,0,0,0.5)',
          color: 'white',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
    </Box>
  )
}



