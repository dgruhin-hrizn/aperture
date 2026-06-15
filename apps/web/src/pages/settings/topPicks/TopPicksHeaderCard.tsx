import { Alert, Box, Card, CardContent, Chip, FormControlLabel, Switch, Typography } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useTranslation } from 'react-i18next'
import type { TopPicksConfig } from './types'
export interface TopPicksHeaderCardProps { config: TopPicksConfig; error: string | null; success: string | null; setError: (v: string | null) => void; setSuccess: (v: string | null) => void; updateConfig: (u: Partial<TopPicksConfig>) => void }
export function TopPicksHeaderCard({ config, error, success, setError, setSuccess, updateConfig }: TopPicksHeaderCardProps) { const { t } = useTranslation(); return (      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon color="primary" /> {t('topPicksAdmin.title')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
                {t('topPicksAdmin.subtitle')}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.isEnabled}
                  onChange={(e) => updateConfig({ isEnabled: e.target.checked })}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Typography fontWeight={500}>
                  {config.isEnabled ? t('topPicksAdmin.enabled') : t('topPicksAdmin.disabled')}
                </Typography>
              }
              labelPlacement="start"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {config.lastRefreshedAt && (
            <Chip
              label={t('topPicksAdmin.lastRefreshed', {
                datetime: new Date(config.lastRefreshedAt).toLocaleString(),
              })}
              size="small"
              variant="outlined"
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>) }