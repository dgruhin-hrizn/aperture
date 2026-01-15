import { useState, useEffect } from 'react'
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
  Collapse,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Dns as DnsIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
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
    existingMediaServer,
    testing,
    saving,
    handleTestMediaServer,
    handleSaveMediaServer,
  } = wizard

  const [showReconfigure, setShowReconfigure] = useState(false)
  const [allowPasswordlessLogin, setAllowPasswordlessLogin] = useState(false)
  const [savingSecuritySetting, setSavingSecuritySetting] = useState(false)

  // Load security settings on mount
  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        const response = await fetch('/api/setup/media-server/security')
        if (response.ok) {
          const data = await response.json()
          setAllowPasswordlessLogin(data.allowPasswordlessLogin)
        }
      } catch {
        // Default to false if we can't fetch
      }
    }
    loadSecuritySettings()
  }, [])

  const handlePasswordlessToggle = async (enabled: boolean) => {
    setSavingSecuritySetting(true)
    try {
      const response = await fetch('/api/setup/media-server/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowPasswordlessLogin: enabled }),
      })
      if (response.ok) {
        setAllowPasswordlessLogin(enabled)
      }
    } catch {
      // Revert on error
    } finally {
      setSavingSecuritySetting(false)
    }
  }

  return (
    <Box>
      {/* Branding header for step 1 */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 4,
          pt: 1,
        }}
      >
        <Box
          component="img"
          src="/aperture.png"
          alt="Aperture"
          sx={{ width: 72, height: 72, mb: 2 }}
        />
        <Typography
          sx={{
            fontFamily: '"Open Sans", sans-serif',
            fontWeight: 600,
            fontSize: '1.75rem',
            color: 'text.primary',
            letterSpacing: '-0.02em',
            mb: 1,
          }}
        >
          Aperture
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 400 }}>
          Discover your next favorite. Every time.
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" gutterBottom>
        Connect Your Media Server
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture integrates with your Emby or Jellyfin server to analyze viewing habits and generate personalized
        recommendations.
      </Typography>

      {/* Existing Server Display */}
      {existingMediaServer && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              Media Server Connected
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              <Chip
                label={existingMediaServer.type === 'emby' ? 'Emby' : 'Jellyfin'}
                size="small"
                color={existingMediaServer.type === 'emby' ? 'success' : 'info'}
                variant="outlined"
                sx={{ mr: 1 }}
              />
              {existingMediaServer.baseUrl}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mt: 0.5 }}>
              API Key: {existingMediaServer.maskedApiKey}
            </Typography>
          </Box>
        </Alert>
      )}

      {error && (
        <Alert severity={error.includes('No servers found') ? 'info' : 'error'} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {testSuccess && !existingMediaServer && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          Connected to {serverName || 'media server'}!
        </Alert>
      )}

      {/* Reconfigure Section - Collapsible when existing server */}
      {existingMediaServer ? (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => setShowReconfigure(!showReconfigure)}
            endIcon={<ExpandMoreIcon sx={{ transform: showReconfigure ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Connect to a different server
          </Button>
          <Collapse in={showReconfigure}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
                <Typography variant="caption">
                  <strong>Need an API key?</strong> In your media server dashboard, go to <strong>Settings → API Keys</strong> and
                  create a new key for Aperture.
                </Typography>
              </Alert>

              {/* Auto-Discovery Section */}
              <Button
                variant="outlined"
                size="small"
                startIcon={discoveringServers ? <CircularProgress size={16} /> : <SearchIcon />}
                onClick={discoverServers}
                disabled={discoveringServers}
                sx={{ mb: 2 }}
              >
                {discoveringServers ? 'Scanning...' : 'Discover Servers'}
              </Button>

              {discoveredServers.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {discoveredServers.map((server) => (
                    <Card
                      key={server.id}
                      variant="outlined"
                      sx={{
                        mb: 1,
                        borderColor: serverUrl === server.address ? 'primary.main' : 'divider',
                        bgcolor: serverUrl === server.address ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <CardActionArea onClick={() => selectDiscoveredServer(server)}>
                        <CardContent sx={{ py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <DnsIcon fontSize="small" color={serverUrl === server.address ? 'primary' : 'action'} />
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
              )}

              <FormControl fullWidth size="small" margin="dense">
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
                size="small"
                label="Server URL"
                placeholder="http://192.168.1.100:8096"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                margin="dense"
              />

              <TextField
                fullWidth
                size="small"
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={serverApiKey}
                onChange={(e) => setServerApiKey(e.target.value)}
                margin="dense"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end" size="small">
                        {showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {serverApiKey && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleTestMediaServer}
                  disabled={testing || !serverUrl || !serverApiKey}
                  sx={{ mt: 2 }}
                >
                  {testing ? <CircularProgress size={16} /> : 'Test New Connection'}
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
            <Typography variant="caption">
              <strong>Need an API key?</strong> In your media server dashboard, go to <strong>Settings → API Keys</strong> and
              create a new key for Aperture. This allows secure read-only access to your library metadata and watch history.
            </Typography>
          </Alert>

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
        </>
      )}

      {/* Security Settings */}
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" gutterBottom>
        Security Settings
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={allowPasswordlessLogin}
              onChange={(e) => handlePasswordlessToggle(e.target.checked)}
              disabled={savingSecuritySetting}
            />
          }
          label="Allow passwordless login"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 4.5, mt: -0.5 }}>
          Enable this if your media server users don't have passwords set
        </Typography>
      </Box>

      {allowPasswordlessLogin && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" fontWeight={500}>
            Security Warning
          </Typography>
          <Typography variant="body2">
            Only enable this if your Aperture instance is on a private network with no internet exposure. 
            If your server is accessible via reverse proxy or the internet, leave this disabled to prevent unauthorized access.
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {!existingMediaServer && (
          <Button variant="outlined" onClick={handleTestMediaServer} disabled={testing || !serverUrl || !serverApiKey}>
            {testing ? <CircularProgress size={20} /> : 'Test Connection'}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSaveMediaServer}
          disabled={saving || (!existingMediaServer && !testSuccess) || (!!existingMediaServer && !!serverApiKey && !testSuccess)}
        >
          {saving ? <CircularProgress size={20} /> : existingMediaServer && !serverApiKey ? 'Continue' : testSuccess ? 'Save & Continue' : 'Continue'}
        </Button>
      </Box>
    </Box>
  )
}
