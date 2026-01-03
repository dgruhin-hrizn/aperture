import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { mountCoverMaker } from '@aperture/cover-maker'
import '@aperture/cover-maker/styles'

export function CoverMakerPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (containerRef.current && !cleanupRef.current) {
      // Mount the Preact Cover Maker app
      cleanupRef.current = mountCoverMaker(containerRef.current)
    }

    return () => {
      // Cleanup on unmount
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  return (
    <Box sx={{ width: '100%', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Cover Maker
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create custom covers for your media libraries. Upload an image, customize the text, and download your cover.
      </Typography>
      {/* Container for the Preact Cover Maker app */}
      <Box
        ref={containerRef}
        id="cover-maker-root"
        sx={{
          width: '100%',
          minHeight: 600,
          '& .text-muted-foreground': {
            color: 'text.secondary',
          },
        }}
      />
    </Box>
  )
}

export default CoverMakerPage

