import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Slider,
  FormControl,
  IconButton,
} from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type { RecommendationConfig, MediaTypeConfig } from '../types'
import { MAX_UNLIMITED } from '../types'

type HelpSettingKey =
  | 'maxCandidates'
  | 'selectedCount'
  | 'recentWatchLimit'
  | 'similarityWeight'
  | 'noveltyWeight'
  | 'ratingWeight'
  | 'diversityWeight'

function HelpIcon({ settingKey }: { settingKey: HelpSettingKey }) {
  const { t } = useTranslation()
  const p = `settingsRecAlgo.help.${settingKey}`
  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {t(`${p}.title`)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t(`${p}.description`)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{t('settingsRecAlgo.helpIncrease')}</strong> {t(`${p}.increase`)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{t('settingsRecAlgo.helpDecrease')}</strong> {t(`${p}.decrease`)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
            💡 {t(`${p}.example`)}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
      enterDelay={200}
      leaveDelay={100}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: 3,
            maxWidth: 320,
            '& .MuiTooltip-arrow': {
              color: 'background.paper',
            },
          },
        },
      }}
    >
      <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
        <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      </IconButton>
    </Tooltip>
  )
}

interface MediaTypeCardProps {
  title: string
  icon: React.ReactNode
  config: MediaTypeConfig
  isDirty: boolean
  isSaving: boolean
  isLoading: boolean
  onSave: () => void
  onReset: () => void
  onUpdateField: <K extends keyof MediaTypeConfig>(field: K, value: MediaTypeConfig[K]) => void
}

function MediaTypeCard({
  title,
  icon,
  config,
  isDirty,
  isSaving,
  isLoading,
  onSave,
  onReset,
  onUpdateField,
}: MediaTypeCardProps) {
  const { t } = useTranslation()
  const totalWeight =
    config.similarityWeight +
    config.noveltyWeight +
    config.ratingWeight +
    config.diversityWeight

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <Box display="flex" gap={0.5}>
            <Tooltip title={t('settingsRecAlgo.resetTooltip')}>
              <Button
                size="small"
                onClick={onReset}
                disabled={isSaving || isLoading}
                sx={{ minWidth: 32 }}
              >
                <RestartAltIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              onClick={onSave}
              disabled={isSaving || isLoading || !isDirty}
              startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />}
            >
              {t('settingsRecAlgo.save')}
            </Button>
          </Box>
        </Box>

        {/* Candidate Selection */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          {t('settingsRecAlgo.sectionSelection')}
        </Typography>

        {/* Max Candidates */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <Box display="flex" alignItems="center">
            <Typography variant="body2">
              {t('settingsRecAlgo.maxCandidatesLabel')}{' '}
              <strong>{config.maxCandidates >= MAX_UNLIMITED ? '∞' : `${(config.maxCandidates / 1000).toFixed(0)}K`}</strong>
            </Typography>
            <HelpIcon settingKey="maxCandidates" />
          </Box>
          <Slider
            value={config.maxCandidates >= MAX_UNLIMITED ? 100 : Math.min(config.maxCandidates / 1000, 100)}
            onChange={(_, v) => {
              const val = v as number
              onUpdateField('maxCandidates', val >= 100 ? MAX_UNLIMITED : val * 1000)
            }}
            min={5}
            max={100}
            size="small"
            marks={[
              { value: 5, label: '5K' },
              { value: 50, label: '50K' },
              { value: 100, label: '∞' },
            ]}
          />
        </FormControl>

        {/* Selected Count */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <Box display="flex" alignItems="center">
            <Typography variant="body2">{t('settingsRecAlgo.recsPerUser')}</Typography>
            <HelpIcon settingKey="selectedCount" />
          </Box>
          <TextField
            type="number"
            value={config.selectedCount}
            onChange={(e) => onUpdateField('selectedCount', Math.max(1, parseInt(e.target.value) || 1))}
            size="small"
            InputProps={{
              inputProps: { min: 1, max: 500 },
            }}
          />
        </FormControl>

        {/* Recent Watch Limit */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <Box display="flex" alignItems="center">
            <Typography variant="body2">{t('settingsRecAlgo.watchHistoryDepth')}</Typography>
            <HelpIcon settingKey="recentWatchLimit" />
          </Box>
          <TextField
            type="number"
            value={config.recentWatchLimit}
            onChange={(e) => onUpdateField('recentWatchLimit', Math.max(1, parseInt(e.target.value) || 1))}
            size="small"
            InputProps={{
              inputProps: { min: 1, max: 500 },
            }}
          />
        </FormControl>

        {/* Weights */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {t('settingsRecAlgo.sectionWeights')}
          </Typography>
          <Chip
            label={`${(totalWeight * 100).toFixed(0)}%`}
            color={Math.abs(totalWeight - 1) < 0.01 ? 'success' : 'warning'}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Box>

        {/* Similarity Weight */}
        <FormControl fullWidth sx={{ mb: 1.5 }} size="small">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Typography variant="body2">{t('settingsRecAlgo.weightSimilarity')}</Typography>
              <HelpIcon settingKey="similarityWeight" />
            </Box>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {(config.similarityWeight * 100).toFixed(0)}%
            </Typography>
          </Box>
          <Slider
            value={config.similarityWeight * 100}
            onChange={(_, v) => onUpdateField('similarityWeight', (v as number) / 100)}
            min={0}
            max={100}
            size="small"
          />
        </FormControl>

        {/* Novelty Weight */}
        <FormControl fullWidth sx={{ mb: 1.5 }} size="small">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Typography variant="body2">{t('settingsRecAlgo.weightDiscovery')}</Typography>
              <HelpIcon settingKey="noveltyWeight" />
            </Box>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {(config.noveltyWeight * 100).toFixed(0)}%
            </Typography>
          </Box>
          <Slider
            value={config.noveltyWeight * 100}
            onChange={(_, v) => onUpdateField('noveltyWeight', (v as number) / 100)}
            min={0}
            max={100}
            size="small"
          />
        </FormControl>

        {/* Rating Weight */}
        <FormControl fullWidth sx={{ mb: 1.5 }} size="small">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Typography variant="body2">{t('settingsRecAlgo.weightRating')}</Typography>
              <HelpIcon settingKey="ratingWeight" />
            </Box>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {(config.ratingWeight * 100).toFixed(0)}%
            </Typography>
          </Box>
          <Slider
            value={config.ratingWeight * 100}
            onChange={(_, v) => onUpdateField('ratingWeight', (v as number) / 100)}
            min={0}
            max={100}
            size="small"
          />
        </FormControl>

        {/* Diversity Weight */}
        <FormControl fullWidth size="small">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Typography variant="body2">{t('settingsRecAlgo.weightDiversity')}</Typography>
              <HelpIcon settingKey="diversityWeight" />
            </Box>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {(config.diversityWeight * 100).toFixed(0)}%
            </Typography>
          </Box>
          <Slider
            value={config.diversityWeight * 100}
            onChange={(_, v) => onUpdateField('diversityWeight', (v as number) / 100)}
            min={0}
            max={100}
            size="small"
          />
        </FormControl>
      </CardContent>
    </Card>
  )
}

interface RecommendationConfigSectionProps {
  recConfig: RecommendationConfig | null
  loadingRecConfig: boolean
  savingRecConfig: boolean
  recConfigError: string | null
  setRecConfigError: (error: string | null) => void
  recConfigSuccess: string | null
  setRecConfigSuccess: (success: string | null) => void
  movieConfigDirty: boolean
  seriesConfigDirty: boolean
  saveMovieConfig: () => void
  saveSeriesConfig: () => void
  resetMovieConfig: () => void
  resetSeriesConfig: () => void
  updateMovieConfigField: <K extends keyof MediaTypeConfig>(field: K, value: MediaTypeConfig[K]) => void
  updateSeriesConfigField: <K extends keyof MediaTypeConfig>(field: K, value: MediaTypeConfig[K]) => void
}

export function RecommendationConfigSection({
  recConfig,
  loadingRecConfig,
  savingRecConfig,
  recConfigError,
  setRecConfigError,
  recConfigSuccess,
  setRecConfigSuccess,
  movieConfigDirty,
  seriesConfigDirty,
  saveMovieConfig,
  saveSeriesConfig,
  resetMovieConfig,
  resetSeriesConfig,
  updateMovieConfigField,
  updateSeriesConfigField,
}: RecommendationConfigSectionProps) {
  const { t } = useTranslation()
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settingsRecAlgo.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('settingsRecAlgo.subtitle')}
      </Typography>

      {recConfigError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRecConfigError(null)}>
          {recConfigError}
        </Alert>
      )}

      {recConfigSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRecConfigSuccess(null)}>
          {recConfigSuccess}
        </Alert>
      )}

      {loadingRecConfig ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : recConfig ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <MediaTypeCard
              title={t('settingsRecAlgo.moviesCardTitle')}
              icon={<MovieIcon color="primary" />}
              config={recConfig.movie}
              isDirty={movieConfigDirty}
              isSaving={savingRecConfig}
              isLoading={loadingRecConfig}
              onSave={saveMovieConfig}
              onReset={resetMovieConfig}
              onUpdateField={updateMovieConfigField}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MediaTypeCard
              title={t('settingsRecAlgo.seriesCardTitle')}
              icon={<TvIcon color="secondary" />}
              config={recConfig.series}
              isDirty={seriesConfigDirty}
              isSaving={savingRecConfig}
              isLoading={loadingRecConfig}
              onSave={saveSeriesConfig}
              onReset={resetSeriesConfig}
              onUpdateField={updateSeriesConfigField}
            />
          </Grid>
        </Grid>
      ) : (
        <Alert severity="warning">
          {t('settingsRecAlgo.loadFailed')}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        {t('settingsRecAlgo.footer')}
      </Typography>
    </Box>
  )
}
