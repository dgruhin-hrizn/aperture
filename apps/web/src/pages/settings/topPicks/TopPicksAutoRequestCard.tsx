import { Alert, Box, Card, CardContent, Collapse, FormControlLabel, Grid, Switch, TextField, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; import MovieIcon from '@mui/icons-material/Movie'; import SendIcon from '@mui/icons-material/Send'; import TvIcon from '@mui/icons-material/Tv'
import { Trans, useTranslation } from 'react-i18next'
import type { TopPicksConfig } from './types'
export interface TopPicksAutoRequestCardProps { config: TopPicksConfig; updateConfig: (u: Partial<TopPicksConfig>) => void }
export function TopPicksAutoRequestCard({ config, updateConfig }: TopPicksAutoRequestCardProps) { const { t } = useTranslation(); return (      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SendIcon fontSize="small" color="primary" />
            {t('topPicksAdmin.autoRequest.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('topPicksAdmin.autoRequest.subtitle')}
          </Typography>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
            <Typography variant="body2" component="div">
              {t('topPicksAdmin.autoRequest.infoLine1')}
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
              <Trans i18nKey="topPicksAdmin.autoRequest.infoLine2" components={{ 1: <strong /> }} />
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            {/* Movies Auto-Request */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MovieIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">{t('topPicksAdmin.autoRequest.moviesSection')}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.moviesAutoRequestEnabled}
                      onChange={(e) => updateConfig({ moviesAutoRequestEnabled: e.target.checked })}
                      disabled={!config.isEnabled || config.moviesPopularitySource === 'emby_history'}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {t('topPicksAdmin.autoRequest.enableMovies')}
                    </Typography>
                  }
                />
                {config.moviesPopularitySource === 'emby_history' && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, ml: 4 }}>
                    {t('topPicksAdmin.autoRequest.requiresExternal')}
                  </Typography>
                )}
                <Collapse in={config.moviesAutoRequestEnabled}>
                  <Box sx={{ mt: 2, ml: 4 }}>
                    <TextField
                      fullWidth
                      label={t('topPicksAdmin.fields.maxRequestsPerRun')}
                      type="number"
                      value={config.moviesAutoRequestLimit}
                      onChange={(e) => updateConfig({ moviesAutoRequestLimit: Math.max(1, parseInt(e.target.value) || 10) })}
                      size="small"
                      disabled={!config.isEnabled}
                      InputProps={{
                        inputProps: { min: 1, max: 100 }
                      }}
                      helperText={t('topPicksAdmin.autoRequest.moviesHelper')}
                    />
                  </Box>
                </Collapse>
              </Card>
            </Grid>

            {/* Series Auto-Request */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TvIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">{t('topPicksAdmin.autoRequest.seriesSection')}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.seriesAutoRequestEnabled}
                      onChange={(e) => updateConfig({ seriesAutoRequestEnabled: e.target.checked })}
                      disabled={!config.isEnabled || config.seriesPopularitySource === 'emby_history'}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {t('topPicksAdmin.autoRequest.enableSeries')}
                    </Typography>
                  }
                />
                {config.seriesPopularitySource === 'emby_history' && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, ml: 4 }}>
                    {t('topPicksAdmin.autoRequest.requiresExternal')}
                  </Typography>
                )}
                <Collapse in={config.seriesAutoRequestEnabled}>
                  <Box sx={{ mt: 2, ml: 4 }}>
                    <TextField
                      fullWidth
                      label={t('topPicksAdmin.fields.maxRequestsPerRun')}
                      type="number"
                      value={config.seriesAutoRequestLimit}
                      onChange={(e) => updateConfig({ seriesAutoRequestLimit: Math.max(1, parseInt(e.target.value) || 10) })}
                      size="small"
                      disabled={!config.isEnabled}
                      InputProps={{
                        inputProps: { min: 1, max: 100 }
                      }}
                      helperText={t('topPicksAdmin.autoRequest.seriesHelper')}
                    />
                  </Box>
                </Collapse>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>) }