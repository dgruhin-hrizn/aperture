import { Box, Typography, Card, CardContent, Alert } from '@mui/material'

export function MediaServerSection() {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={3}>
          Media Server
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Media server configuration is managed via environment variables in <code>.env.local</code>.
          Restart the container after making changes.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Required environment variables:
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, color: 'text.secondary' }}>
          <li><code>MEDIA_SERVER_TYPE</code> - emby or jellyfin</li>
          <li><code>MEDIA_SERVER_BASE_URL</code> - Server URL (e.g., http://emby:8096)</li>
          <li><code>MEDIA_SERVER_API_KEY</code> - Admin API key</li>
        </Box>
      </CardContent>
    </Card>
  )
}

