import React from 'react'
import { Box, Skeleton, Stack } from '@mui/material'

export function LoadingSkeleton() {
  return (
    <Box>
      <Box mb={4}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="text" width={350} height={24} />
      </Box>
      <Stack spacing={4}>
        {[1, 2, 3].map((i) => (
          <Box key={i}>
            <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(340px, 1fr))" gap={2}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}


