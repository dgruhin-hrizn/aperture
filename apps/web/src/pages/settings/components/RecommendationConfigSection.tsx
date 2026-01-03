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

// Help text for each setting
const HELP_TEXT = {
  maxCandidates: {
    title: 'Max Candidates',
    description: 'How many items from your library to evaluate as potential recommendations.',
    increase: 'More thorough search, considers entire library, but slower processing.',
    decrease: 'Faster generation, but may miss some good matches from less popular items.',
    example: 'Set to ∞ (unlimited) for best results if you have time, or 10-20K for faster daily runs.',
  },
  selectedCount: {
    title: 'Recommendations Per User',
    description: 'The final number of recommendations each user receives.',
    increase: 'More choices for users, but quality of later picks may decrease.',
    decrease: 'Fewer but higher-quality, more confident recommendations.',
    example: 'Movies: 20-50 is typical. Series: 10-15 since they require more time investment.',
  },
  recentWatchLimit: {
    title: 'Watch History Depth',
    description: 'How many recently watched items to analyze when building the taste profile.',
    increase: 'Broader understanding of long-term preferences, better for established users.',
    decrease: 'Focuses on recent viewing habits, good if tastes change frequently.',
    example: 'New user with 20 watches? Set to 20. Long-time user? 50-100 captures their full taste.',
  },
  similarityWeight: {
    title: 'Taste Similarity',
    description: 'How much to favor items that match the user\'s established preferences.',
    increase: 'Safer picks the user will likely enjoy, but less adventurous.',
    decrease: 'More variety and surprises, but higher chance of misses.',
    example: 'Set high (50-60%) for picky viewers. Set lower (30-40%) for those who like discovering new things.',
  },
  noveltyWeight: {
    title: 'Genre Discovery',
    description: 'Rewards items with genres the user hasn\'t explored much.',
    increase: 'Pushes users outside their comfort zone into new genres.',
    decrease: 'Sticks to familiar territory and known favorite genres.',
    example: 'Someone who only watches action? Higher novelty might suggest a thriller or sci-fi they\'d enjoy.',
  },
  ratingWeight: {
    title: 'Community Rating',
    description: 'How much to favor highly-rated, critically acclaimed items.',
    increase: 'Prioritizes quality over personalization - great for new users.',
    decrease: 'Ignores ratings, trusts the taste-matching algorithm more.',
    example: 'Set higher (30%+) if you want to surface hidden gems with great reviews.',
  },
  diversityWeight: {
    title: 'Result Diversity',
    description: 'Ensures variety in the final recommendation list.',
    increase: 'Spreads recommendations across different genres, years, styles.',
    decrease: 'May cluster similar items together if they all score well.',
    example: 'High diversity prevents getting 10 Marvel movies in a row even if the user loves them.',
  },
}

interface HelpIconProps {
  settingKey: keyof typeof HELP_TEXT
}

function HelpIcon({ settingKey }: HelpIconProps) {
  const help = HELP_TEXT[settingKey]
  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {help.title}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {help.description}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>↑ Increase:</strong> {help.increase}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>↓ Decrease:</strong> {help.decrease}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
            💡 {help.example}
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
            <Tooltip title="Reset to defaults">
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
              Save
            </Button>
          </Box>
        </Box>

        {/* Candidate Selection */}
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          SELECTION
        </Typography>

        {/* Max Candidates */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <Box display="flex" alignItems="center">
            <Typography variant="body2">
              Max Candidates: <strong>{config.maxCandidates >= MAX_UNLIMITED ? '∞' : `${(config.maxCandidates / 1000).toFixed(0)}K`}</strong>
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
            <Typography variant="body2">Recs Per User</Typography>
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
            <Typography variant="body2">Watch History Depth</Typography>
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
            WEIGHTS
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
              <Typography variant="body2">Similarity</Typography>
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
              <Typography variant="body2">Discovery</Typography>
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
              <Typography variant="body2">Rating</Typography>
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
              <Typography variant="body2">Diversity</Typography>
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
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recommendation Algorithm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure how recommendations are generated. Hover over the <HelpOutlineIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> icons for detailed explanations.
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
              title="Movies"
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
              title="TV Series"
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
          Could not load recommendation configuration. Try refreshing the page.
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        Changes apply to the next recommendation generation run.
      </Typography>
    </Box>
  )
}
