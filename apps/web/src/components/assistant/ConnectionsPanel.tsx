import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import { useTranslation } from 'react-i18next'
import { assistantRequest } from './hooks/useConversations'
import type { EncoreScope } from '@aperture/core/encore'
interface Connection { id: string; name: string; token_prefix: string; scopes: EncoreScope[]; expires_at: string; last_used_at: string | null }

export function ConnectionsPanel() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [availableScopes, setAvailableScopes] = useState<EncoreScope[]>([])
  const [scopes, setScopes] = useState<EncoreScope[]>([])
  const [name, setName] = useState('')
  const [days, setDays] = useState(90)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const load = useCallback(async () => {
    const data = await assistantRequest<{ connections: Connection[]; availableScopes: EncoreScope[] }>('/api/assistant/connections')
    setConnections(data.connections); setAvailableScopes(data.availableScopes)
    return data
  }, [])
  useEffect(() => { let live = true; void load().then((data) => { if (live) setScopes(data.availableScopes.filter((s) => s.endsWith(':read'))) }).catch((e) => { if (live) setError(String(e)) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [load])
  async function create() {
    setBusy(true); setError(''); setCopied(false)
    try { const result = await assistantRequest<{ token: string }>('/api/assistant/connections', { method: 'POST', body: JSON.stringify({ name, scopes, days }) }); setToken(result.token); setName(''); await load() }
    catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function revoke(id: string) {
    setBusy(true); setError('')
    try { await assistantRequest(`/api/assistant/connections/${id}`, { method: 'DELETE' }); setToken(''); await load() }
    catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function copyToken() {
    try {
      if (!navigator.clipboard) throw new Error(t('encore.clipboardUnavailable'))
      await navigator.clipboard.writeText(token); setCopied(true)
    } catch (e) { setError(String(e)) }
  }
  const bridgeConfig = JSON.stringify({ mcpServers: { aperture: { command: 'node', args: ['/absolute/path/aperture-mcp.mjs'], env: { APERTURE_URL: window.location.origin, APERTURE_MCP_TOKEN: '<APERTURE_MCP_TOKEN>' } } } }, null, 2)
  return <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}><Stack spacing={3} sx={{ maxWidth: 760, mx: 'auto' }}>
    <Box><LinkOutlinedIcon color="primary" /><Typography variant="h5" sx={{ mt: 1 }}>{t('encore.connectionsTitle')}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{t('encore.connectionsIntro')}</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {token && <Alert severity="success"><Typography variant="subtitle2">{t('encore.tokenCreated')}</Typography><Typography variant="body2" sx={{ my: 1 }}>{t('encore.tokenOnce')}</Typography><TextField fullWidth size="small" value={token} inputProps={{ readOnly: true, 'aria-label': t('encore.tokenLabel') }} /><Button onClick={() => void copyToken()}>{copied ? t('encore.copied') : t('encore.copyToken')}</Button></Alert>}
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }} component="form" onSubmit={(e) => { e.preventDefault(); void create() }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>{t('encore.createConnection')}</Typography>
      <Stack spacing={2}><TextField label={t('encore.connectionName')} value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 80 }} required />
        <TextField type="number" label={t('encore.expiresDays')} value={days} onChange={(e) => setDays(Number(e.target.value))} inputProps={{ min: 1, max: 365 }} />
        <Box>{availableScopes.map((scope) => <FormControlLabel key={scope} control={<Checkbox checked={scopes.includes(scope)} onChange={(_e, checked) => setScopes((previous) => checked ? [...previous, scope] : previous.filter((s) => s !== scope))} />} label={t(`encore.scopes.${scope.replace(':', '_')}`)} />)}</Box>
        <Button type="submit" variant="contained" disabled={busy || !name.trim() || !scopes.length || days < 1 || days > 365}>{t('encore.createConnection')}</Button>
      </Stack>
    </Paper>
    {loading ? <CircularProgress size={22} /> : connections.map((connection) => <Paper variant="outlined" key={connection.id} sx={{ p: 2.5, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><Box sx={{ flex: 1 }}><Typography fontWeight={600}>{connection.name}</Typography><Typography variant="caption" color="text.secondary">{connection.token_prefix}… · {t('encore.expiresOn', { date: new Date(connection.expires_at).toLocaleDateString() })}</Typography></Box><Button color="error" disabled={busy} onClick={() => void revoke(connection.id)}>{t('encore.revoke')}</Button></Box>
      <Stack direction="row" flexWrap="wrap" gap={.5} sx={{ mt: 1 }}>{connection.scopes.map((scope) => <Chip size="small" key={scope} label={t(`encore.scopes.${scope.replace(':', '_')}`)} />)}</Stack>
    </Paper>)}
    <Box><Typography variant="subtitle1" fontWeight={600}>{t('encore.connectInstructions')}</Typography><Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{t('encore.connectLocal')}</Typography><TextField fullWidth value={`${window.location.origin}/mcp`} inputProps={{ readOnly: true }} label={t('encore.mcpEndpoint')} />
      <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>{t('encore.bridgeInstructions')}</Typography><Box component="pre" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 3, overflowX: 'auto', fontSize: 12 }}>{bridgeConfig}</Box>
      <Alert severity="info">{t('encore.externalMemoryBoundary')}</Alert>
    </Box>
  </Stack></Box>
}
