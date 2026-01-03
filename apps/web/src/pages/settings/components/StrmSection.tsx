import { Box, Typography, Card, CardContent, Alert } from '@mui/material'

export function StrmSection() {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={3}>
          STRM Libraries
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          STRM configuration is managed via environment variables in <code>.env.local</code>.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Configuration options:
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, color: 'text.secondary' }}>
          <li><code>AI_LIBRARY_NAME_PREFIX</code> - Library name prefix (default: "AI Picks - ")</li>
          <li><code>AI_LIBRARY_PATH_PREFIX</code> - Path prefix (default: /strm/aperture/)</li>
          <li><code>MEDIA_SERVER_STRM_ROOT</code> - STRM root directory (default: /strm)</li>
        </Box>
      </CardContent>
    </Card>
  )
}

