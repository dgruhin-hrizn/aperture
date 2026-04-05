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
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext } from '../types'

interface MediaServerStepProps {
  wizard: SetupWizardContext
}

export function MediaServerStep({ wizard }: MediaServerStepProps) {
  const { t } = useTranslation()
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
          alt={t('setup.page.altLogo')}
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
          {t('setup.page.brandName')}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 400 }}>
          {t('setup.mediaServer.tagline')}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" gutterBottom>
        {t('setup.mediaServer.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.mediaServer.subtitle')}
      </Typography>

      {/* Existing Server Display */}
      {existingMediaServer && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {t('setup.mediaServer.connectedTitle')}
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
              {t('setup.mediaServer.apiKeyLabel')} {existingMediaServer.maskedApiKey}
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
          {t('setup.mediaServer.connectedTo', { name: serverName || t('setup.mediaServer.connectedFallback') })}
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
            {t('setup.mediaServer.reconfigure')}
          </Button>
          <Collapse in={showReconfigure}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
                <Typography variant="caption">{t('setup.mediaServer.needApiKeyShort')}</Typography>
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
                {discoveringServers ? t('setup.mediaServer.discoverScanning') : t('setup.mediaServer.discoverServers')}
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
                <InputLabel>{t('setup.mediaServer.serverType')}</InputLabel>
                <Select value={serverType} label={t('setup.mediaServer.serverType')} onChange={(e) => setServerType(e.target.value)}>
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
                label={t('setup.mediaServer.serverUrl')}
                placeholder={t('setup.mediaServer.urlPlaceholder')}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                margin="dense"
              />

              <TextField
                fullWidth
                size="small"
                label={t('setup.mediaServer.apiKey')}
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
                  {testing ? <CircularProgress size={16} /> : t('setup.mediaServer.testNewConnection')}
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
            <Typography variant="caption">{t('setup.mediaServer.needApiKeyLong')}</Typography>
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
              {discoveringServers ? t('setup.mediaServer.discoverScanningNetwork') : t('setup.mediaServer.discoverOnNetwork')}
            </Button>

            {discoveredServers.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('setup.mediaServer.foundServers', { count: discoveredServers.length })}
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

            {discoveredServers.length > 0 && <Divider sx={{ my: 2 }}>{t('setup.mediaServer.orManual')}</Divider>}
          </Box>

          {/* Manual Entry Section */}
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('setup.mediaServer.serverType')}</InputLabel>
            <Select value={serverType} label={t('setup.mediaServer.serverType')} onChange={(e) => setServerType(e.target.value)}>
              {mediaServerTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label={t('setup.mediaServer.serverUrl')}
            placeholder={t('setup.mediaServer.urlPlaceholder')}
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            margin="normal"
            helperText={t('setup.mediaServer.urlHelper')}
          />

          <TextField
            fullWidth
            label={t('setup.mediaServer.apiKey')}
            type={showApiKey ? 'text' : 'password'}
            value={serverApiKey}
            onChange={(e) => setServerApiKey(e.target.value)}
            margin="normal"
            helperText={t('setup.mediaServer.apiKeyHelper', {
              server: serverType === 'emby' ? 'Emby' : 'Jellyfin',
            })}
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
        {t('setup.mediaServer.securityTitle')}
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
          label={t('setup.mediaServer.passwordlessLabel')}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 4.5, mt: -0.5 }}>
          {t('setup.mediaServer.passwordlessHelper')}
        </Typography>
      </Box>

      {allowPasswordlessLogin && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" fontWeight={500}>
            {t('setup.mediaServer.securityWarningTitle')}
          </Typography>
          <Typography variant="body2">{t('setup.mediaServer.securityWarningBody')}</Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {!existingMediaServer && (
          <Button variant="outlined" onClick={handleTestMediaServer} disabled={testing || !serverUrl || !serverApiKey}>
            {testing ? <CircularProgress size={20} /> : t('setup.mediaServer.testConnection')}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSaveMediaServer}
          disabled={saving || (!existingMediaServer && !testSuccess) || (!!existingMediaServer && !!serverApiKey && !testSuccess)}
        >
          {saving ? (
            <CircularProgress size={20} />
          ) : existingMediaServer && !serverApiKey ? (
            t('setup.mediaServer.continue')
          ) : testSuccess ? (
            t('setup.mediaServer.saveContinue')
          ) : (
            t('setup.mediaServer.continue')
          )}
        </Button>
      </Box>
    </Box>
  )
}
