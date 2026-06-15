import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../../hooks/useUserRatings'
import { useWatching } from '../../hooks/useWatching'
import type { ViewMode } from '../../hooks/view-mode-context'
import {
  BrowseSeriesListItem,
  FilterPopper,
  FilterPresetManager,
  SortPopper,
  type SeriesFilters,
} from './components'
import { useBrowseFilterPresets, useBrowseSeries } from './hooks'

type BrowseSeriesHook = ReturnType<typeof useBrowseSeries>
type BrowsePresetsHook = ReturnType<typeof useBrowseFilterPresets>

interface BrowseSeriesTabProps {
  viewMode: ViewMode
  series: BrowseSeriesHook
  presets: BrowsePresetsHook
}

function renderSkeleton(viewMode: ViewMode) {
  return viewMode === 'grid' ? (
    <Grid container spacing={2}>
      {Array.from({ length: 12 }).map((_, index) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
          <MoviePoster title="" loading responsive />
        </Grid>
      ))}
    </Grid>
  ) : (
    <Box display="flex" flexDirection="column" gap={2}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Box key={index} display="flex" gap={2} bgcolor="background.paper" borderRadius={2} p={2}>
          <Skeleton variant="rectangular" width={100} height={150} sx={{ borderRadius: 1 }} />
          <Box flexGrow={1}>
            <Skeleton variant="text" width="60%" height={30} />
            <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
            <Box display="flex" gap={0.5} mb={1}>
              <Skeleton variant="rectangular" width={60} height={22} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" width={70} height={22} sx={{ borderRadius: 1 }} />
            </Box>
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="80%" />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export function BrowseSeriesTab({ viewMode, series, presets }: BrowseSeriesTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()

  const handleRateSeries = useCallback(
    async (seriesId: string, rating: number | null) => {
      try {
        await setRating('series', seriesId, rating)
      } catch (err) {
        console.error('Failed to rate series:', err)
      }
    },
    [setRating]
  )

  const handleLoadPreset = useCallback(
    (preset: Parameters<BrowsePresetsHook['handleLoadSeriesPreset']>[0]) => {
      presets.handleLoadSeriesPreset(
        preset,
        series.setSeriesFilters,
        series.setSeriesGenre,
        series.setNetwork
      )
    },
    [presets, series.setNetwork, series.setSeriesFilters, series.setSeriesGenre]
  )

  const handleSavePreset = useCallback(
    async (name: string) => {
      await presets.handleSaveSeriesPreset(
        name,
        series.seriesFilters,
        series.seriesGenre,
        series.network
      )
    },
    [presets, series.network, series.seriesFilters, series.seriesGenre]
  )

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 10,
          backgroundColor: 'background.default',
          py: 2,
          mx: -3,
          px: 3,
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder={t('browse.searchSeriesPlaceholder')}
            value={series.seriesSearch}
            onChange={(event) => series.setSeriesSearch(event.target.value)}
            size="small"
            sx={{ width: { xs: '100%', sm: 180 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
            <InputLabel>{t('browse.labels.genre')}</InputLabel>
            <Select
              value={series.seriesGenre}
              label={t('browse.labels.genre')}
              onChange={(event) => series.setSeriesGenre(event.target.value)}
            >
              <MenuItem value="">{t('browse.labels.allGenres')}</MenuItem>
              {series.seriesGenres.map((genre) => (
                <MenuItem key={genre} value={genre}>
                  {genre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
            <InputLabel>{t('browse.labels.network')}</InputLabel>
            <Select
              value={series.network}
              label={t('browse.labels.network')}
              onChange={(event) => series.setNetwork(event.target.value)}
            >
              <MenuItem value="">{t('browse.labels.allNetworks')}</MenuItem>
              {series.networks.map((networkName) => (
                <MenuItem key={networkName} value={networkName}>
                  {networkName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FilterPopper
            type="series"
            filters={series.seriesFilters}
            onChange={(filters) => series.setSeriesFilters(filters as SeriesFilters)}
            contentRatings={series.seriesContentRatings}
            countries={series.seriesCountries}
            ranges={series.seriesRanges}
          />

          <SortPopper
            type="series"
            sortBy={series.seriesSortBy}
            sortOrder={series.seriesSortOrder}
            onChange={series.handleSeriesSortChange}
          />

          <FilterPresetManager
            type="series"
            currentFilters={series.seriesFilters}
            currentGenre={series.seriesGenre}
            currentNetwork={series.network}
            presets={presets.filterPresets}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onDeletePreset={presets.handleDeletePreset}
            onRenamePreset={presets.handleRenamePreset}
          />
        </Box>

        {series.activeFilters.length > 0 && (
          <Box display="flex" gap={0.5} flexWrap="wrap" mt={1.5}>
            {series.activeFilters.map((chip, index) => (
              <Chip
                key={index}
                label={chip.label}
                size="small"
                onDelete={chip.onDelete}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Box>

      {series.seriesError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {series.seriesError}
        </Alert>
      )}

      {series.seriesLoading ? (
        renderSkeleton(viewMode)
      ) : series.series.length === 0 ? (
        <Typography color="text.secondary">
          {series.seriesSearch || series.seriesGenre || series.network || series.activeFilters.length > 0
            ? t('browse.empty.seriesFiltered')
            : t('browse.empty.seriesNoSync')}
        </Typography>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {series.series.map((show) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={show.id}>
                  <MoviePoster
                    title={show.title}
                    year={show.year}
                    posterUrl={show.poster_url}
                    rating={show.community_rating}
                    genres={show.genres}
                    overview={show.overview}
                    userRating={getRating('series', show.id)}
                    onRate={(rating) => void handleRateSeries(show.id, rating)}
                    isWatching={isWatching(show.id)}
                    onWatchingToggle={() => toggleWatching(show.id)}
                    responsive
                    onClick={() => navigate(`/series/${show.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {series.series.map((show) => (
                <BrowseSeriesListItem
                  key={show.id}
                  series={show}
                  userRating={getRating('series', show.id)}
                  onRate={(rating) => void handleRateSeries(show.id, rating)}
                  isWatching={isWatching(show.id)}
                  onWatchingToggle={() => toggleWatching(show.id)}
                  onClick={() => navigate(`/series/${show.id}`)}
                />
              ))}
            </Box>
          )}

          <Box
            ref={series.seriesLoadMoreRef}
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={4}
          >
            {series.seriesLoadingMore && <CircularProgress size={32} />}
            {!series.seriesHasMore && series.series.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('browse.loadMore.allSeries', {
                  count: series.seriesTotal.toLocaleString(),
                })}
              </Typography>
            )}
          </Box>
        </>
      )}
    </>
  )
}
