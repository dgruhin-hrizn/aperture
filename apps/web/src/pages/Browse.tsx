import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import PersonIcon from '@mui/icons-material/Person'
import TvIcon from '@mui/icons-material/Tv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import type { SortField, SortOrder } from './browse/components'
import { browseTabFromSearchParam } from './browse/constants'
import { BrowseMoviesTab } from './browse/BrowseMoviesTab'
import { BrowsePeopleTab } from './browse/BrowsePeopleTab'
import { BrowseSeriesTab } from './browse/BrowseSeriesTab'
import { useBrowseFilterPresets, useBrowseMovies, useBrowsePeople, useBrowseSeries } from './browse/hooks'
import { useViewMode } from '../hooks/useViewMode'

export function BrowsePage() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTabIndex = browseTabFromSearchParam(searchParams.get('tab'))
  const [tabIndex, setTabIndex] = useState(initialTabIndex)
  const tabQuery = searchParams.get('tab')
  const { viewMode, setViewMode } = useViewMode('browse')
  const { viewMode: peopleViewMode, setViewMode: setPeopleViewMode } = useViewMode('browsePeople')
  const presetsRef = useRef<ReturnType<typeof useBrowseFilterPresets> | null>(null)

  useEffect(() => {
    setTabIndex(browseTabFromSearchParam(tabQuery))
  }, [tabQuery])

  const persistMovieSort = useCallback((sortBy: SortField, sortOrder: SortOrder) => {
    void presetsRef.current?.persistSortPreferences('movies', sortBy, sortOrder)
  }, [])

  const persistSeriesSort = useCallback((sortBy: SortField, sortOrder: SortOrder) => {
    void presetsRef.current?.persistSortPreferences('series', sortBy, sortOrder)
  }, [])

  const movies = useBrowseMovies({ tabIndex, persistSortPreferences: persistMovieSort })
  const series = useBrowseSeries({ tabIndex, persistSortPreferences: persistSeriesSort })
  const people = useBrowsePeople({ tabIndex, initialTabIsPeople: initialTabIndex === 2 })
  const presets = useBrowseFilterPresets({
    setMovieSortBy: movies.setMovieSortBy,
    setMovieSortOrder: movies.setMovieSortOrder,
    setSeriesSortBy: series.setSeriesSortBy,
    setSeriesSortOrder: series.setSeriesSortOrder,
  })
  presetsRef.current = presets

  const currentViewMode = tabIndex === 2 ? peopleViewMode : viewMode
  const handleTabChange = useCallback(
    (_event: SyntheticEvent, newValue: number) => {
      setTabIndex(newValue)
      setSearchParams({ tab: newValue === 1 ? 'series' : newValue === 2 ? 'people' : 'movies' })
    },
    [setSearchParams]
  )

  const handleViewModeChange = useCallback(
    (_event: MouseEvent<HTMLElement>, nextViewMode: 'grid' | 'list' | null) => {
      if (!nextViewMode) return
      if (tabIndex === 2) {
        setPeopleViewMode(nextViewMode)
      } else {
        setViewMode(nextViewMode)
      }
    },
    [setPeopleViewMode, setViewMode, tabIndex]
  )

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={{ xs: 0, sm: 1 }}>
            <VideoLibraryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              {t('browse.title')}
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              {t('browse.subtitleLine', {
                count:
                  tabIndex === 0
                    ? movies.movieTotal.toLocaleString()
                    : tabIndex === 1
                      ? series.seriesTotal.toLocaleString()
                      : people.peopleTotal.toLocaleString(),
                kind:
                  tabIndex === 0
                    ? t('browse.subtitleKindMovies')
                    : tabIndex === 1
                      ? t('browse.subtitleKindSeries')
                      : t('browse.subtitleKindPeople'),
              })}
            </Typography>
          )}
        </Box>

        <ToggleButtonGroup value={currentViewMode} exclusive onChange={handleViewModeChange} size="small">
          <ToggleButton value="grid">
            <GridViewIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={<MovieIcon />}
            iconPosition="start"
            label={t('browse.tabMovies')}
            sx={{
              color: tabIndex === 0 ? '#6366f1' : 'text.secondary',
              '&.Mui-selected': { color: '#6366f1' },
            }}
          />
          <Tab
            icon={<TvIcon />}
            iconPosition="start"
            label={t('browse.tabSeries')}
            sx={{
              color: tabIndex === 1 ? '#ec4899' : 'text.secondary',
              '&.Mui-selected': { color: '#ec4899' },
            }}
          />
          <Tab
            icon={<PersonIcon />}
            iconPosition="start"
            label={t('browse.tabPeople')}
            sx={{
              color: tabIndex === 2 ? '#14b8a6' : 'text.secondary',
              '&.Mui-selected': { color: '#14b8a6' },
            }}
          />
        </Tabs>
      </Box>

      {tabIndex === 0 ? (
        <BrowseMoviesTab viewMode={viewMode} movies={movies} presets={presets} />
      ) : tabIndex === 1 ? (
        <BrowseSeriesTab viewMode={viewMode} series={series} presets={presets} />
      ) : (
        <BrowsePeopleTab viewMode={peopleViewMode} people={people} />
      )}
    </Box>
  )
}
