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
  Divider,
  Tooltip,
  Slider,
  FormControl,
  FormHelperText,
  InputAdornment,
} from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import type { RecommendationConfig } from '../types'
import { MAX_UNLIMITED } from '../types'

interface RecommendationConfigSectionProps {
  recConfig: RecommendationConfig | null
  loadingRecConfig: boolean
  savingRecConfig: boolean
  recConfigError: string | null
  setRecConfigError: (error: string | null) => void
  recConfigSuccess: string | null
  setRecConfigSuccess: (success: string | null) => void
  recConfigDirty: boolean
  onSave: () => void
  onReset: () => void
  onUpdateField: <K extends keyof RecommendationConfig>(field: K, value: RecommendationConfig[K]) => void
}

export function RecommendationConfigSection({
  recConfig,
  loadingRecConfig,
  savingRecConfig,
  recConfigError,
  setRecConfigError,
  recConfigSuccess,
  setRecConfigSuccess,
  recConfigDirty,
  onSave,
  onReset,
  onUpdateField,
}: RecommendationConfigSectionProps) {
  const totalWeight =
    (recConfig?.similarityWeight || 0) +
    (recConfig?.noveltyWeight || 0) +
    (recConfig?.ratingWeight || 0) +
    (recConfig?.diversityWeight || 0)

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <TuneIcon color="primary" />
            <Box>
              <Typography variant="h6">Recommendation Algorithm</Typography>
              <Typography variant="body2" color="text.secondary">
                Fine-tune how recommendations are generated for all users
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Reset all settings to defaults">
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={onReset}
                disabled={savingRecConfig || loadingRecConfig}
                size="small"
              >
                Reset Defaults
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={savingRecConfig ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={onSave}
              disabled={savingRecConfig || loadingRecConfig || !recConfigDirty}
              size="small"
            >
              {savingRecConfig ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>

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
          <Grid container spacing={4}>
            {/* Count Settings */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Candidate Selection
              </Typography>

              {/* Max Candidates */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Max Candidates to Consider
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Slider
                    value={recConfig.maxCandidates >= MAX_UNLIMITED ? 100 : Math.min(recConfig.maxCandidates / 1000, 100)}
                    onChange={(_, v) => {
                      const val = v as number
                      onUpdateField('maxCandidates', val >= 100 ? MAX_UNLIMITED : val * 1000)
                    }}
                    min={5}
                    max={100}
                    marks={[
                      { value: 5, label: '5K' },
                      { value: 25, label: '25K' },
                      { value: 50, label: '50K' },
                      { value: 100, label: '∞' },
                    ]}
                    sx={{ flex: 1 }}
                  />
                  <Chip
                    label={recConfig.maxCandidates >= MAX_UNLIMITED ? 'UNLIMITED' : `${(recConfig.maxCandidates / 1000).toFixed(0)}K`}
                    color={recConfig.maxCandidates >= MAX_UNLIMITED ? 'success' : 'default'}
                    size="small"
                    sx={{ minWidth: 90 }}
                  />
                </Box>
                <FormHelperText>
                  How many movies to evaluate. <strong>Lower:</strong> faster generation. <strong>Higher/Unlimited:</strong> more thorough, considers entire library.
                </FormHelperText>
              </FormControl>

              {/* Selected Count */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Recommendations Per User
                </Typography>
                <TextField
                  type="number"
                  value={recConfig.selectedCount}
                  onChange={(e) => onUpdateField('selectedCount', Math.max(1, parseInt(e.target.value) || 1))}
                  size="small"
                  InputProps={{
                    inputProps: { min: 1, max: 500 },
                    endAdornment: <InputAdornment position="end">movies</InputAdornment>,
                  }}
                />
                <FormHelperText>
                  Final number of recommendations shown per user (1-500).
                </FormHelperText>
              </FormControl>

              {/* Recent Watch Limit */}
              <FormControl fullWidth>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Taste Profile Size
                </Typography>
                <TextField
                  type="number"
                  value={recConfig.recentWatchLimit}
                  onChange={(e) => onUpdateField('recentWatchLimit', Math.max(1, parseInt(e.target.value) || 1))}
                  size="small"
                  InputProps={{
                    inputProps: { min: 1, max: 500 },
                    endAdornment: <InputAdornment position="end">recent watches</InputAdornment>,
                  }}
                />
                <FormHelperText>
                  Number of recently watched movies used to build taste profile. <strong>Lower:</strong> focuses on very recent preferences. <strong>Higher:</strong> broader taste analysis.
                </FormHelperText>
              </FormControl>
            </Grid>

            {/* Weight Sliders */}
            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Scoring Weights
                </Typography>
                <Chip
                  label={`Total: ${(totalWeight * 100).toFixed(0)}%`}
                  color={Math.abs(totalWeight - 1) < 0.01 ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Controls how different factors influence the final score. Ideally should sum to 100%.
              </Typography>

              {/* Similarity Weight */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={500}>
                    Taste Similarity
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    {(recConfig.similarityWeight * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={recConfig.similarityWeight * 100}
                  onChange={(_, v) => onUpdateField('similarityWeight', (v as number) / 100)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <FormHelperText>
                  How closely a movie matches user's taste profile. <strong>Low:</strong> more variety, less predictable. <strong>High:</strong> safer picks based on what they like.
                </FormHelperText>
              </FormControl>

              {/* Novelty Weight */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={500}>
                    Genre Discovery
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    {(recConfig.noveltyWeight * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={recConfig.noveltyWeight * 100}
                  onChange={(_, v) => onUpdateField('noveltyWeight', (v as number) / 100)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <FormHelperText>
                  Rewards movies with some unfamiliar genres. <strong>Low:</strong> stick to known genres. <strong>High:</strong> encourage exploring new genres.
                </FormHelperText>
              </FormControl>

              {/* Rating Weight */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={500}>
                    Community Rating
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    {(recConfig.ratingWeight * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={recConfig.ratingWeight * 100}
                  onChange={(_, v) => onUpdateField('ratingWeight', (v as number) / 100)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <FormHelperText>
                  Favor highly-rated movies. <strong>Low:</strong> rating doesn't matter. <strong>High:</strong> prioritize critically acclaimed films.
                </FormHelperText>
              </FormControl>

              {/* Diversity Weight */}
              <FormControl fullWidth>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={500}>
                    Result Diversity
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    {(recConfig.diversityWeight * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={recConfig.diversityWeight * 100}
                  onChange={(_, v) => onUpdateField('diversityWeight', (v as number) / 100)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <FormHelperText>
                  Ensure variety in final recommendations. <strong>Low:</strong> may cluster similar movies. <strong>High:</strong> spreads across different genres.
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="warning">
            Could not load recommendation configuration. Try refreshing the page.
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary">
          ⚡ Changes apply to the next recommendation generation. Run "Generate Recommendations" job after saving.
        </Typography>
      </CardContent>
    </Card>
  )
}

