import { Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel, Grid, InputAdornment, InputLabel, ListItemText, MenuItem, OutlinedInput, Select, Slider, Switch, TextField, Typography } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import MovieIcon from '@mui/icons-material/Movie'
import PublicIcon from '@mui/icons-material/Public'
import SaveIcon from '@mui/icons-material/Save'
import TranslateIcon from '@mui/icons-material/Translate'
import TvIcon from '@mui/icons-material/Tv'
import { useTranslation } from 'react-i18next'
import { MDBListSelector } from '../components/MDBListSelector'
import { LibraryMatchPreview } from '../components/LibraryMatchPreview'
import { COMMON_LANGUAGES } from './constants'
import type { HybridExternalSource, HybridSourceOption, LibraryMatchResult, PopularitySource, PreviewCounts, SortOption, SourceOption, TopPicksConfig, TopPicksMediaType } from './types'

export interface TopPicksMediaSettingsCardProps {
  mediaType: TopPicksMediaType
  config: TopPicksConfig
  mdblistConfigured: boolean
  sourceOptions: SourceOption[]
  hybridExternalOptions: HybridSourceOption[]
  sortOptions: SortOption[]
  getLanguageName: (code: string) => string
  extendedLanguageCodes: string[]
  matchLoading: boolean
  libraryMatch: LibraryMatchResult | null
  matchExpanded: boolean
  onMatchExpandToggle: () => void
  onOpenPreview: () => void
  previewCounts: PreviewCounts | null
  previewLoading: boolean
  hasChanges: boolean
  saving: boolean
  onSave: () => void
  updateConfig: (updates: Partial<TopPicksConfig>) => void
}

export function TopPicksMediaSettingsCard({
  mediaType,
  config,
  mdblistConfigured,
  sourceOptions,
  hybridExternalOptions,
  sortOptions,
  getLanguageName,
  extendedLanguageCodes,
  matchLoading,
  libraryMatch,
  matchExpanded,
  onMatchExpandToggle,
  onOpenPreview,
  previewCounts,
  previewLoading,
  hasChanges,
  saving,
  onSave,
  updateConfig,
}: TopPicksMediaSettingsCardProps) {
  const { t } = useTranslation()
  if (mediaType === 'movies') {
    return (
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MovieIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.movies.settingsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('topPicksAdmin.movies.settingsSubtitle')}
              </Typography>

          {/* Data Source */}
          <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
            <InputLabel id="movies-source-label">{t('topPicksAdmin.fields.dataSource')}</InputLabel>
            <Select
              labelId="movies-source-label"
              label={t('topPicksAdmin.fields.dataSource')}
              value={config.moviesPopularitySource}
              onChange={(e) => updateConfig({ moviesPopularitySource: e.target.value as PopularitySource })}
            >
              {sourceOptions.map((opt) => (
                <MenuItem 
                  key={opt.value} 
                  value={opt.value}
                  disabled={opt.requiresMdblist && !mdblistConfigured}
                >
                  <Box>
                    <Typography variant="body2">{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Hybrid External Source Selector */}
          {config.moviesPopularitySource === 'hybrid' && (
            <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
              <InputLabel id="movies-hybrid-source-label">{t('topPicksAdmin.fields.externalSourceBlend')}</InputLabel>
              <Select
                labelId="movies-hybrid-source-label"
                label={t('topPicksAdmin.fields.externalSourceBlend')}
                value={config.moviesHybridExternalSource || 'tmdb_popular'}
                onChange={(e) => updateConfig({ moviesHybridExternalSource: e.target.value as HybridExternalSource })}
              >
                {hybridExternalOptions.map((opt) => (
                  <MenuItem 
                    key={opt.value} 
                    value={opt.value}
                    disabled={opt.requiresMdblist && !mdblistConfigured}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Library Match Preview for TMDB sources */}
          {(config.moviesPopularitySource.startsWith('tmdb_') || 
            (config.moviesPopularitySource === 'hybrid' && config.moviesHybridExternalSource?.startsWith('tmdb_'))) && (
            <Box sx={{ mb: 3 }}>
              <LibraryMatchPreview
                loading={matchLoading}
                data={libraryMatch}
                expanded={matchExpanded}
                onExpandToggle={onMatchExpandToggle}
                onOpenPreview={() => onOpenPreview()}
              />
            </Box>
          )}

          {/* MDBList Selector (for mdblist source or hybrid with mdblist) */}
          {((config.moviesPopularitySource === 'mdblist') || 
            (config.moviesPopularitySource === 'hybrid' && config.moviesHybridExternalSource === 'mdblist')) && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={8}>
                  <MDBListSelector
                    value={config.mdblistMoviesListId ? { id: config.mdblistMoviesListId, name: config.mdblistMoviesListName || '' } : null}
                    onChange={(newValue) => {
                      updateConfig({
                        mdblistMoviesListId: newValue?.id || null,
                        mdblistMoviesListName: newValue?.name || null,
                      })
                    }}
                    mediatype="movie"
                    label={t('topPicksAdmin.movies.listLabel')}
                    helperText={t('topPicksAdmin.movies.listHelper')}
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="movies-sort-label">{t('topPicksAdmin.fields.sortBy')}</InputLabel>
                    <Select
                      labelId="movies-sort-label"
                      label={t('topPicksAdmin.fields.sortBy')}
                      value={config.mdblistMoviesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistMoviesSort: e.target.value })}
                    >
                      {sortOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistMoviesListId && (
                <LibraryMatchPreview
                  loading={matchLoading}
                  data={libraryMatch}
                  expanded={matchExpanded}
                  onExpandToggle={onMatchExpandToggle}
                  onOpenPreview={() => onOpenPreview()}
                />
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.moviesPopularitySource === 'emby_history' || config.moviesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.timeWindow')}
                  type="number"
                  value={config.moviesTimeWindowDays}
                  onChange={(e) => updateConfig({ moviesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{t('topPicksAdmin.fields.daysSuffix')}</InputAdornment>,
                  }}
                  size="small"
                  helperText={t('topPicksAdmin.fields.timeWindowHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.minViewers')}
                  type="number"
                  value={config.moviesMinUniqueViewers}
                  onChange={(e) => updateConfig({ moviesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText={t('topPicksAdmin.fields.minViewersHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('topPicksAdmin.movies.matchingCriteria')}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.movies ?? t('topPicksAdmin.emDash')
                    )}
                  </Typography>
                  {previewCounts && previewCounts.movies > 30 && config.moviesPopularitySource === 'emby_history' && (
                    <Typography variant="caption" color="warning.main">
                      {t('topPicksAdmin.movies.largeListWarning', {
                        count: previewCounts.recommendedMoviesMinViewers,
                      })}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights */}
          {config.moviesPopularitySource === 'hybrid' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksAdmin.hybrid.blendWeightTitle')}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridExternalWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => t('topPicksAdmin.hybrid.sliderLocal', { percent: v })}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('topPicksAdmin.hybrid.blendSummary', {
                  localPercent: Math.round(config.hybridLocalWeight * 100),
                  externalPercent: Math.round((config.hybridExternalWeight || (1 - config.hybridLocalWeight)) * 100),
                })}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Language Filter */}
          {config.moviesPopularitySource !== 'emby_history' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TranslateIcon fontSize="small" />
                {t('topPicksAdmin.fields.languageFilter')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {t('topPicksAdmin.movies.languageFilterHint')}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled}>
                    <InputLabel id="movies-language-label">{t('topPicksAdmin.fields.languages')}</InputLabel>
                    <Select
                      labelId="movies-language-label"
                      label={t('topPicksAdmin.fields.languages')}
                      multiple
                      value={config.moviesLanguages || []}
                      onChange={(e) => updateConfig({ moviesLanguages: e.target.value as string[] })}
                      input={<OutlinedInput label={t('topPicksAdmin.fields.languages')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={getLanguageName(value)} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {COMMON_LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          <Checkbox checked={(config.moviesLanguages || []).includes(lang)} />
                          <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                        </MenuItem>
                      ))}
                      <Divider />
                      {extendedLanguageCodes.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            <Checkbox checked={(config.moviesLanguages || []).includes(lang)} />
                            <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.moviesIncludeUnknownLanguage ?? true}
                        onChange={(e) => updateConfig({ moviesIncludeUnknownLanguage: e.target.checked })}
                        disabled={!config.isEnabled || (config.moviesLanguages || []).length === 0}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{t('topPicksAdmin.language.includeUnknown')}</Typography>}
                  />
                </Grid>
              </Grid>
              {(config.moviesLanguages || []).length > 0 && (
                <Button
                  size="small"
                  onClick={() => updateConfig({ moviesLanguages: [], moviesIncludeUnknownLanguage: true })}
                  sx={{ mt: 1 }}
                >
                  {t('topPicksAdmin.language.clearFilter')}
                </Button>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            {t('topPicksAdmin.fields.listSize')}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {t('topPicksAdmin.movies.listSizeHint')}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.moviesUseAllMatches}
                    onChange={(e) => updateConfig({ moviesUseAllMatches: e.target.checked })}
                    disabled={!config.isEnabled}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {config.moviesUseAllMatches
                      ? t('topPicksAdmin.listMode.useAllMatches')
                      : t('topPicksAdmin.listMode.limitCount')}
                  </Typography>
                }
              />
            </Grid>
            {!config.moviesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.movies.moviesToShow')}
                  type="number"
                  value={config.moviesCount}
                  onChange={(e) => updateConfig({ moviesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.moviesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>

          {/* Save Button */}
          {hasChanges && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={() => void onSave()}
                disabled={saving}
                size="small"
              >
                {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
              </Button>
            </Box>
          )}
            </CardContent>
          </Card>
    )
  }
  return (
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TvIcon fontSize="small" color="primary" />
                {t('topPicksAdmin.series.settingsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('topPicksAdmin.series.settingsSubtitle')}
              </Typography>

          {/* Data Source */}
          <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
            <InputLabel id="series-source-label">{t('topPicksAdmin.fields.dataSource')}</InputLabel>
            <Select
              labelId="series-source-label"
              label={t('topPicksAdmin.fields.dataSource')}
              value={config.seriesPopularitySource}
              onChange={(e) => updateConfig({ seriesPopularitySource: e.target.value as PopularitySource })}
            >
              {sourceOptions.map((opt) => (
                <MenuItem 
                  key={opt.value} 
                  value={opt.value}
                  disabled={opt.requiresMdblist && !mdblistConfigured}
                >
                  <Box>
                    <Typography variant="body2">{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Hybrid External Source Selector */}
          {config.seriesPopularitySource === 'hybrid' && (
            <FormControl fullWidth disabled={!config.isEnabled} sx={{ mb: 3 }}>
              <InputLabel id="series-hybrid-source-label">{t('topPicksAdmin.fields.externalSourceBlend')}</InputLabel>
              <Select
                labelId="series-hybrid-source-label"
                label={t('topPicksAdmin.fields.externalSourceBlend')}
                value={config.seriesHybridExternalSource || 'tmdb_popular'}
                onChange={(e) => updateConfig({ seriesHybridExternalSource: e.target.value as HybridExternalSource })}
              >
                {hybridExternalOptions.map((opt) => (
                  <MenuItem 
                    key={opt.value} 
                    value={opt.value}
                    disabled={opt.requiresMdblist && !mdblistConfigured}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Library Match Preview for TMDB sources */}
          {(config.seriesPopularitySource.startsWith('tmdb_') || 
            (config.seriesPopularitySource === 'hybrid' && config.seriesHybridExternalSource?.startsWith('tmdb_'))) && (
            <Box sx={{ mb: 3 }}>
              <LibraryMatchPreview
                loading={matchLoading}
                data={libraryMatch}
                expanded={matchExpanded}
                onExpandToggle={onMatchExpandToggle}
                onOpenPreview={() => onOpenPreview()}
              />
            </Box>
          )}

          {/* MDBList Selector (for mdblist source or hybrid with mdblist) */}
          {((config.seriesPopularitySource === 'mdblist') || 
            (config.seriesPopularitySource === 'hybrid' && config.seriesHybridExternalSource === 'mdblist')) && mdblistConfigured && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={8}>
                  <MDBListSelector
                    value={config.mdblistSeriesListId ? { id: config.mdblistSeriesListId, name: config.mdblistSeriesListName || '' } : null}
                    onChange={(newValue) => {
                      updateConfig({
                        mdblistSeriesListId: newValue?.id || null,
                        mdblistSeriesListName: newValue?.name || null,
                      })
                    }}
                    mediatype="show"
                    label={t('topPicksAdmin.series.listLabel')}
                    helperText={t('topPicksAdmin.series.listHelper')}
                    disabled={!config.isEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled} variant="outlined">
                    <InputLabel id="series-sort-label">{t('topPicksAdmin.fields.sortBy')}</InputLabel>
                    <Select
                      labelId="series-sort-label"
                      label={t('topPicksAdmin.fields.sortBy')}
                      value={config.mdblistSeriesSort || 'score'}
                      onChange={(e) => updateConfig({ mdblistSeriesSort: e.target.value })}
                    >
                      {sortOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Library Match Preview */}
              {config.mdblistSeriesListId && (
                <LibraryMatchPreview
                  loading={matchLoading}
                  data={libraryMatch}
                  expanded={matchExpanded}
                  onExpandToggle={onMatchExpandToggle}
                  onOpenPreview={() => onOpenPreview()}
                />
              )}
            </Box>
          )}

          {/* Local/Hybrid Settings */}
          {(config.seriesPopularitySource === 'emby_history' || config.seriesPopularitySource === 'hybrid') && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.timeWindow')}
                  type="number"
                  value={config.seriesTimeWindowDays}
                  onChange={(e) => updateConfig({ seriesTimeWindowDays: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{t('topPicksAdmin.fields.daysSuffix')}</InputAdornment>,
                  }}
                  size="small"
                  helperText={t('topPicksAdmin.fields.timeWindowHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.fields.minViewers')}
                  type="number"
                  value={config.seriesMinUniqueViewers}
                  onChange={(e) => updateConfig({ seriesMinUniqueViewers: parseInt(e.target.value) || 1 })}
                  size="small"
                  helperText={t('topPicksAdmin.fields.minViewersHelper')}
                  disabled={!config.isEnabled}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {/* Preview Count */}
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('topPicksAdmin.series.matchingCriteria')}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {previewLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      previewCounts?.series ?? t('topPicksAdmin.emDash')
                    )}
                  </Typography>
                  {previewCounts && previewCounts.series > 30 && config.seriesPopularitySource === 'emby_history' && (
                    <Typography variant="caption" color="warning.main">
                      {t('topPicksAdmin.series.largeListWarning', {
                        count: previewCounts.recommendedSeriesMinViewers,
                      })}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Hybrid Weights (shared with movies) */}
          {config.seriesPopularitySource === 'hybrid' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksAdmin.hybrid.blendWeightTitle')}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <HomeIcon fontSize="small" color="primary" />
                <Slider
                  value={config.hybridLocalWeight * 100}
                  onChange={(_, value) => updateConfig({ 
                    hybridLocalWeight: (value as number) / 100,
                    hybridExternalWeight: 1 - (value as number) / 100,
                  })}
                  min={0}
                  max={100}
                  disabled={!config.isEnabled}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => t('topPicksAdmin.hybrid.sliderLocal', { percent: v })}
                  sx={{ flex: 1 }}
                />
                <PublicIcon fontSize="small" color="primary" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('topPicksAdmin.hybrid.blendSummary', {
                  localPercent: Math.round(config.hybridLocalWeight * 100),
                  externalPercent: Math.round((config.hybridExternalWeight || (1 - config.hybridLocalWeight)) * 100),
                })}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Language Filter */}
          {config.seriesPopularitySource !== 'emby_history' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TranslateIcon fontSize="small" />
                {t('topPicksAdmin.fields.languageFilter')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {t('topPicksAdmin.series.languageFilterHint')}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <FormControl fullWidth size="small" disabled={!config.isEnabled}>
                    <InputLabel id="series-language-label">{t('topPicksAdmin.fields.languages')}</InputLabel>
                    <Select
                      labelId="series-language-label"
                      label={t('topPicksAdmin.fields.languages')}
                      multiple
                      value={config.seriesLanguages || []}
                      onChange={(e) => updateConfig({ seriesLanguages: e.target.value as string[] })}
                      input={<OutlinedInput label={t('topPicksAdmin.fields.languages')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={getLanguageName(value)} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {COMMON_LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          <Checkbox checked={(config.seriesLanguages || []).includes(lang)} />
                          <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                        </MenuItem>
                      ))}
                      <Divider />
                      {extendedLanguageCodes.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            <Checkbox checked={(config.seriesLanguages || []).includes(lang)} />
                            <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.seriesIncludeUnknownLanguage ?? true}
                        onChange={(e) => updateConfig({ seriesIncludeUnknownLanguage: e.target.checked })}
                        disabled={!config.isEnabled || (config.seriesLanguages || []).length === 0}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{t('topPicksAdmin.language.includeUnknown')}</Typography>}
                  />
                </Grid>
              </Grid>
              {(config.seriesLanguages || []).length > 0 && (
                <Button
                  size="small"
                  onClick={() => updateConfig({ seriesLanguages: [], seriesIncludeUnknownLanguage: true })}
                  sx={{ mt: 1 }}
                >
                  {t('topPicksAdmin.language.clearFilter')}
                </Button>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* List Size */}
          <Typography variant="body2" fontWeight={500} gutterBottom>
            {t('topPicksAdmin.fields.listSize')}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {t('topPicksAdmin.series.listSizeHint')}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.seriesUseAllMatches}
                    onChange={(e) => updateConfig({ seriesUseAllMatches: e.target.checked })}
                    disabled={!config.isEnabled}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {config.seriesUseAllMatches
                      ? t('topPicksAdmin.listMode.useAllMatches')
                      : t('topPicksAdmin.listMode.limitCount')}
                  </Typography>
                }
              />
            </Grid>
            {!config.seriesUseAllMatches && (
              <Grid item xs={6} sm={4} md={3}>
                <TextField
                  fullWidth
                  label={t('topPicksAdmin.series.seriesToShow')}
                  type="number"
                  value={config.seriesCount}
                  onChange={(e) => updateConfig({ seriesCount: parseInt(e.target.value) || 10 })}
                  size="small"
                  disabled={!config.isEnabled || config.seriesUseAllMatches}
                />
              </Grid>
            )}
          </Grid>

          {/* Save Button */}
          {hasChanges && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={() => void onSave()}
                disabled={saving}
                size="small"
              >
                {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
              </Button>
            </Box>
          )}
            </CardContent>
          </Card>
  )
}
