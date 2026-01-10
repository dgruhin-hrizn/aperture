import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Dns as DnsIcon,
} from '@mui/icons-material'
import type { SetupWizardContext } from '../types'

interface MediaServerStepProps {
  wizard: SetupWizardContext
}

export function MediaServerStep({ wizard }: MediaServerStepProps) {
  const {
    error,
    testSuccess,
    serverName,
    mediaServerTypes,
    discoveredServers,
    discoveringServers,
    discoverServers,
    selectDiscoveredServer,
    serverType,
    setServerType,
    serverUrl,
    setServerUrl,
    serverApiKey,
    setServerApiKey,
    showApiKey,
    setShowApiKey,
    testing,
    saving,
    handleTestMediaServer,
    handleSaveMediaServer,
  } = wizard

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Connect Your Media Server
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture integrates with your Emby or Jellyfin server to analyze viewing habits and generate personalized
        recommendations. Click "Discover" to automatically find servers on your network, or enter the connection
        details manually below.
      </Typography>

      <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
        <Typography variant="caption">
          <strong>Need an API key?</strong> In your media server dashboard, go to <strong>Settings → API Keys</strong> and
          create a new key for Aperture. This allows secure read-only access to your library metadata and watch history.
        </Typography>
      </Alert>

      {error && (
        <Alert severity={error.includes('No servers found') ? 'info' : 'error'} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {testSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          Connected to {serverName || 'media server'}!
        </Alert>
      )}

      {/* Auto-Discovery Section */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={discoveringServers ? <CircularProgress size={18} /> : <SearchIcon />}
          onClick={discoverServers}
          disabled={discoveringServers}
          fullWidth
          sx={{ mb: 2 }}
        >
          {discoveringServers ? 'Scanning Network...' : 'Discover Servers on Network'}
        </Button>

        {discoveredServers.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Found {discoveredServers.length} server{discoveredServers.length > 1 ? 's' : ''}:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {discoveredServers.map((server) => (
                <Card
                  key={server.id}
                  variant="outlined"
                  sx={{
                    borderColor: serverUrl === server.address ? 'primary.main' : 'divider',
                    bgcolor: serverUrl === server.address ? 'action.selected' : 'background.paper',
                  }}
                >
                  <CardActionArea onClick={() => selectDiscoveredServer(server)}>
                    <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <DnsIcon color={serverUrl === server.address ? 'primary' : 'action'} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {server.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {server.address}
                        </Typography>
                      </Box>
                      <Chip
                        label={server.type === 'emby' ? 'Emby' : 'Jellyfin'}
                        size="small"
                        color={server.type === 'emby' ? 'success' : 'info'}
                        variant="outlined"
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {discoveredServers.length > 0 && <Divider sx={{ my: 2 }}>or enter manually</Divider>}
      </Box>

      {/* Manual Entry Section */}
      <FormControl fullWidth margin="normal">
        <InputLabel>Server Type</InputLabel>
        <Select value={serverType} label="Server Type" onChange={(e) => setServerType(e.target.value)}>
          {mediaServerTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Server URL"
        placeholder="http://192.168.1.100:8096"
        value={serverUrl}
        onChange={(e) => setServerUrl(e.target.value)}
        margin="normal"
        helperText="Include the protocol (http/https) and port"
      />

      <TextField
        fullWidth
        label="API Key"
        type={showApiKey ? 'text' : 'password'}
        value={serverApiKey}
        onChange={(e) => setServerApiKey(e.target.value)}
        margin="normal"
        helperText={`Find this in your ${serverType === 'emby' ? 'Emby' : 'Jellyfin'} dashboard under API Keys`}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end">
                {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={handleTestMediaServer} disabled={testing || !serverUrl || !serverApiKey}>
          {testing ? <CircularProgress size={20} /> : 'Test Connection'}
        </Button>
        <Button variant="contained" onClick={handleSaveMediaServer} disabled={saving || !testSuccess}>
          {saving ? <CircularProgress size={20} /> : 'Continue'}
        </Button>
      </Box>
    </Box>
  )
}
