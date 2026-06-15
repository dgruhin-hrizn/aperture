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
import type { ViewMode } from '../../hooks/view-mode-context'
import {
  BrowseMovieListItem,
  FilterPopper,
  FilterPresetManager,
  SortPopper,
  type FilterPreset,
  type MovieFilters,
} from './components'
import { useBrowseFilterPresets, useBrowseMovies } from './hooks'

type BrowseMoviesHook = ReturnType<typeof useBrowseMovies>
type BrowsePresetsHook = ReturnType<typeof useBrowseFilterPresets>

interface BrowseMoviesTabProps {
  viewMode: ViewMode
  movies: BrowseMoviesHook
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

export function BrowseMoviesTab({ viewMode, movies, presets }: BrowseMoviesTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()

  const handleRateMovie = useCallback(
    async (movieId: string, rating: number | null) => {
      try {
        await setRating('movie', movieId, rating)
      } catch (err) {
        console.error('Failed to rate movie:', err)
      }
    },
    [setRating]
  )

  const handleLoadPreset = useCallback(
    (preset: FilterPreset) => {
      presets.handleLoadMoviePreset(
        preset,
        movies.setMovieFilters,
        movies.setMovieGenre,
        movies.setCollection
      )
    },
    [movies.setCollection, movies.setMovieFilters, movies.setMovieGenre, presets]
  )

  const handleSavePreset = useCallback(
    async (name: string) => {
      await presets.handleSaveMoviePreset(
        name,
        movies.movieFilters,
        movies.movieGenre,
        movies.collection
      )
    },
    [movies.collection, movies.movieFilters, movies.movieGenre, presets]
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
            placeholder={t('browse.searchMoviesPlaceholder')}
            value={movies.movieSearch}
            onChange={(event) => movies.setMovieSearch(event.target.value)}
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
              value={movies.movieGenre}
              label={t('browse.labels.genre')}
              onChange={(event) => movies.setMovieGenre(event.target.value)}
            >
              <MenuItem value="">{t('browse.labels.allGenres')}</MenuItem>
              {movies.movieGenres.map((genre) => (
                <MenuItem key={genre} value={genre}>
                  {genre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {movies.collections.length > 0 && (
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
              <InputLabel>{t('browse.labels.franchise')}</InputLabel>
              <Select
                value={movies.collection}
                label={t('browse.labels.franchise')}
                onChange={(event) => movies.setCollection(event.target.value)}
              >
                <MenuItem value="">{t('browse.labels.allFranchises')}</MenuItem>
                {movies.collections.map((collection) => (
                  <MenuItem key={collection.name} value={collection.name}>
                    {collection.name} ({collection.count})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FilterPopper
            type="movies"
            filters={movies.movieFilters}
            onChange={(filters) => movies.setMovieFilters(filters as MovieFilters)}
            contentRatings={movies.movieContentRatings}
            resolutions={movies.movieResolutions}
            countries={movies.movieCountries}
            ranges={movies.movieRanges}
          />

          <SortPopper
            type="movies"
            sortBy={movies.movieSortBy}
            sortOrder={movies.movieSortOrder}
            onChange={movies.handleMovieSortChange}
          />

          <FilterPresetManager
            type="movies"
            currentFilters={movies.movieFilters}
            currentGenre={movies.movieGenre}
            currentCollection={movies.collection}
            presets={presets.filterPresets}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onDeletePreset={presets.handleDeletePreset}
            onRenamePreset={presets.handleRenamePreset}
          />
        </Box>

        {movies.activeFilters.length > 0 && (
          <Box display="flex" gap={0.5} flexWrap="wrap" mt={1.5}>
            {movies.activeFilters.map((chip, index) => (
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

      {movies.moviesError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {movies.moviesError}
        </Alert>
      )}

      {movies.moviesLoading ? (
        renderSkeleton(viewMode)
      ) : movies.movies.length === 0 ? (
        <Typography color="text.secondary">
          {movies.movieSearch || movies.movieGenre || movies.collection || movies.activeFilters.length > 0
            ? t('browse.empty.moviesFiltered')
            : t('browse.empty.moviesNoSync')}
        </Typography>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {movies.movies.map((movie) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id}>
                  <MoviePoster
                    title={movie.title}
                    year={movie.year}
                    posterUrl={movie.poster_url}
                    rating={movie.community_rating}
                    genres={movie.genres}
                    overview={movie.overview}
                    userRating={getRating('movie', movie.id)}
                    onRate={(rating) => void handleRateMovie(movie.id, rating)}
                    responsive
                    onClick={() => navigate(`/movies/${movie.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {movies.movies.map((movie) => (
                <BrowseMovieListItem
                  key={movie.id}
                  movie={movie}
                  userRating={getRating('movie', movie.id)}
                  onRate={(rating) => void handleRateMovie(movie.id, rating)}
                  onClick={() => navigate(`/movies/${movie.id}`)}
                />
              ))}
            </Box>
          )}

          <Box
            ref={movies.movieLoadMoreRef}
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={4}
          >
            {movies.moviesLoadingMore && <CircularProgress size={32} />}
            {!movies.movieHasMore && movies.movies.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('browse.loadMore.allMovies', {
                  count: movies.movieTotal.toLocaleString(),
                })}
              </Typography>
            )}
          </Box>
        </>
      )}
    </>
  )
}
