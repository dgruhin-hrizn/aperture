import { Box, CircularProgress } from '@mui/material'

export function PageLoading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <CircularProgress />
    </Box>
  )
}
