import { Alert, Box, Card, CardContent, Chip, Grid, Slider, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GroupIcon from '@mui/icons-material/Group'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TuneIcon from '@mui/icons-material/Tune'
import { Trans, useTranslation } from 'react-i18next'
import type { TopPicksConfig } from './types'
export interface TopPicksLocalAlgorithmCardProps { config: TopPicksConfig; updateConfig:(u:Partial<TopPicksConfig>)=>void }
export function TopPicksLocalAlgorithmCard({config,updateConfig}:TopPicksLocalAlgorithmCardProps){const{t}=useTranslation();const totalWeight=config.uniqueViewersWeight+config.playCountWeight+config.completionWeight;const getProportionalPercent=(w:number)=>(totalWeight>0?Math.round((w/totalWeight)*100):33);const show=config.moviesPopularitySource==='emby_history'||config.moviesPopularitySource==='hybrid'||config.seriesPopularitySource==='emby_history'||config.seriesPopularitySource==='hybrid';if(!show)return null;return(
<Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.localAlgorithm.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('topPicksAdmin.localAlgorithm.subtitle')}
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ my: 2 }}>
            <Typography variant="body2" component="div">
              <Trans
                i18nKey="topPicksAdmin.localAlgorithm.factors"
                components={{ strong: <strong />, br: <br /> }}
              />
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.uniqueViewers')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.uniqueViewersWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.uniqueViewersWeight * 100)}
                onChange={(_, value) => updateConfig({ uniqueViewersWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <PlayArrowIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.playCount')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.playCountWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.playCountWeight * 100)}
                onChange={(_, value) => updateConfig({ playCountWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.localAlgorithm.completionRate')}</Typography>
                <Chip 
                  label={`${getProportionalPercent(config.completionWeight)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={Math.round(config.completionWeight * 100)}
                onChange={(_, value) => updateConfig({ completionWeight: (value as number) / 100 })}
                min={0}
                max={100}
                step={1}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
)}