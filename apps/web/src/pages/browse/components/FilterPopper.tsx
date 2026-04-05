import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Popper,
  Typography,
  alpha,
  useTheme,
  ClickAwayListener,
  Badge,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { RangeSlider } from './RangeSlider'
import { ChipToggleGroup } from './ChipToggleGroup'

export type WatchStatusFilter = 'any' | 'watched' | 'unwatched'

export interface MovieFilters {
  yearRange: [number, number]
  runtimeRange: [number, number]
  communityRating: [number, number]
  rtScore: [number, number]
  metacritic: [number, number]
  contentRatings: string[]
  resolutions: string[]
  countries: string[]
  watchStatus: WatchStatusFilter
  minWatchers: number | null
  maxWatchers: number | null
}

export interface SeriesFilters {
  yearRange: [number, number]
  seasonsRange: [number, number]
  communityRating: [number, number]
  rtScore: [number, number]
  metacritic: [number, number]
  contentRatings: string[]
  status: string[]
  countries: string[]
  watchStatus: WatchStatusFilter
  minWatchers: number | null
  maxWatchers: number | null
}

interface FilterPopperProps {
  type: 'movies' | 'series'
  filters: MovieFilters | SeriesFilters
  onChange: (filters: MovieFilters | SeriesFilters) => void
  contentRatings: { rating: string; count: number }[]
  resolutions?: { resolution: string; count: number }[]
  countries?: { country: string; count: number }[]
  ranges: {
    year: { min: number; max: number }
    runtime?: { min: number; max: number }
    seasons?: { min: number; max: number }
    rating: { min: number; max: number }
  }
}

const defaultMovieFilters: MovieFilters = {
  yearRange: [1900, new Date().getFullYear()],
  runtimeRange: [0, 300],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  resolutions: [],
  countries: [],
  watchStatus: 'any',
  minWatchers: null,
  maxWatchers: null,
}

const defaultSeriesFilters: SeriesFilters = {
  yearRange: [1950, new Date().getFullYear()],
  seasonsRange: [1, 30],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  status: [],
  countries: [],
  watchStatus: 'any',
  minWatchers: null,
  maxWatchers: null,
}

export function FilterPopper({
  type,
  filters,
  onChange,
  contentRatings,
  resolutions,
  countries = [],
  ranges,
}: FilterPopperProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scores: true,
    year: true,
    content: true,
    runtime: true,
    quality: true,
    status: true,
    origin: true,
    audience: true,
  })

  const open = Boolean(anchorEl)

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleReset = () => {
    if (type === 'movies') {
      onChange({
        ...defaultMovieFilters,
        yearRange: [ranges.year.min, ranges.year.max],
        runtimeRange: ranges.runtime ? [ranges.runtime.min, ranges.runtime.max] : [0, 300],
      })
    } else {
      onChange({
        ...defaultSeriesFilters,
        yearRange: [ranges.year.min, ranges.year.max],
        seasonsRange: ranges.seasons ? [ranges.seasons.min, ranges.seasons.max] : [1, 30],
      })
    }
  }

  const parseOptionalInt = (raw: string): number | null => {
    const t = raw.trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isNaN(n) ? null : n
  }

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    
    if (type === 'movies') {
      const f = filters as MovieFilters
      if (f.yearRange[0] > ranges.year.min || f.yearRange[1] < ranges.year.max) count++
      if (f.runtimeRange[0] > (ranges.runtime?.min || 0) || f.runtimeRange[1] < (ranges.runtime?.max || 300)) count++
      if (f.communityRating[0] > 0 || f.communityRating[1] < 10) count++
      if (f.rtScore[0] > 0 || f.rtScore[1] < 100) count++
      if (f.metacritic[0] > 0 || f.metacritic[1] < 100) count++
      if (f.contentRatings.length > 0) count++
      if (f.resolutions.length > 0) count++
      if (f.countries.length > 0) count++
      if (f.watchStatus !== 'any') count++
      if (f.minWatchers !== null) count++
      if (f.maxWatchers !== null) count++
    } else {
      const f = filters as SeriesFilters
      if (f.yearRange[0] > ranges.year.min || f.yearRange[1] < ranges.year.max) count++
      if (f.seasonsRange[0] > (ranges.seasons?.min || 1) || f.seasonsRange[1] < (ranges.seasons?.max || 30)) count++
      if (f.communityRating[0] > 0 || f.communityRating[1] < 10) count++
      if (f.rtScore[0] > 0 || f.rtScore[1] < 100) count++
      if (f.metacritic[0] > 0 || f.metacritic[1] < 100) count++
      if (f.contentRatings.length > 0) count++
      if (f.status.length > 0) count++
      if (f.countries.length > 0) count++
      if (f.watchStatus !== 'any') count++
      if (f.minWatchers !== null) count++
      if (f.maxWatchers !== null) count++
    }
    
    return count
  }

  const activeCount = getActiveFilterCount()

  const SectionHeader = ({
    titleKey,
    section,
  }: {
    titleKey: string
    section: string
  }) => (
    <Box
      onClick={() => toggleSection(section)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        py: 1,
        '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.04) },
        borderRadius: 1,
        mx: -1,
        px: 1,
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
        {t(titleKey)}
      </Typography>
      {expandedSections[section] ? (
        <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      ) : (
        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      )}
    </Box>
  )

  return (
    <>
      <Badge badgeContent={activeCount} color="primary" overlap="rectangular">
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}
          size="small"
          sx={{
            height: 40,
            px: 1.75,
            borderColor: open || activeCount > 0 ? 'primary.main' : alpha(theme.palette.text.primary, 0.23),
            color: open || activeCount > 0 ? 'primary.main' : 'text.primary',
            backgroundColor: open ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
            textTransform: 'none',
            fontWeight: 400,
            '&:hover': {
              borderColor: open || activeCount > 0 ? 'primary.main' : 'text.primary',
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          {t('filterPopper.filters')}
        </Button>
      </Badge>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ zIndex: 1300 }}
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      >
        <ClickAwayListener onClickAway={() => setAnchorEl(null)}>
          <Paper
            elevation={8}
            sx={{
              width: 340,
              maxHeight: '70vh',
              overflow: 'auto',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
                position: 'sticky',
                top: 0,
                backgroundColor: 'background.paper',
                zIndex: 1,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                {t('filterPopper.filters')}
              </Typography>
              <IconButton size="small" onClick={handleReset} title={t('filterPopper.resetAllTooltip')}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{ p: 2 }}>
              {/* Scores Section */}
              <SectionHeader titleKey="filterPopper.sections.scores" section="scores" />
              <Collapse in={expandedSections.scores}>
                <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <RangeSlider
                    label={t('filterPopper.communityRating')}
                    value={filters.communityRating}
                    onChange={(value) => onChange({ ...filters, communityRating: value })}
                    min={0}
                    max={10}
                    step={0.5}
                    formatValue={(v) => v.toFixed(1)}
                  />
                  <RangeSlider
                    label={t('filterPopper.rtCriticScore')}
                    value={filters.rtScore}
                    onChange={(value) => onChange({ ...filters, rtScore: value })}
                    min={0}
                    max={100}
                    step={5}
                    formatValue={(v) => `${v}%`}
                  />
                  <RangeSlider
                    label={t('filterPopper.metacritic')}
                    value={filters.metacritic}
                    onChange={(value) => onChange({ ...filters, metacritic: value })}
                    min={0}
                    max={100}
                    step={5}
                    formatValue={(v) => `${v}`}
                  />
                </Box>
              </Collapse>

              <Divider sx={{ my: 1.5 }} />

              {/* Year Section */}
              <SectionHeader titleKey="filterPopper.sections.year" section="year" />
              <Collapse in={expandedSections.year}>
                <Box sx={{ py: 1.5 }}>
                  <RangeSlider
                    label={t('filterPopper.releaseYear')}
                    value={filters.yearRange}
                    onChange={(value) => onChange({ ...filters, yearRange: value })}
                    min={ranges.year.min}
                    max={ranges.year.max}
                    step={1}
                  />
                </Box>
              </Collapse>

              <Divider sx={{ my: 1.5 }} />

              {/* Content Rating Section */}
              {contentRatings.length > 0 && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.contentRating" section="content" />
                  <Collapse in={expandedSections.content}>
                    <Box sx={{ py: 1.5 }}>
                      <ChipToggleGroup
                        label=""
                        options={contentRatings.map((r) => ({
                          value: r.rating,
                          label: r.rating,
                          count: r.count,
                        }))}
                        selected={filters.contentRatings}
                        onChange={(selected) => onChange({ ...filters, contentRatings: selected })}
                      />
                    </Box>
                  </Collapse>
                  <Divider sx={{ my: 1.5 }} />
                </>
              )}

              {/* Origin: production countries */}
              {countries.length > 0 && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.productionCountry" section="origin" />
                  <Collapse in={expandedSections.origin}>
                    <Box sx={{ py: 1.5, maxHeight: 200, overflow: 'auto' }}>
                      <ChipToggleGroup
                        label=""
                        options={countries.map((c) => ({
                          value: c.country,
                          label: c.country,
                          count: c.count,
                        }))}
                        selected={filters.countries}
                        onChange={(selected) => onChange({ ...filters, countries: selected })}
                      />
                    </Box>
                  </Collapse>
                  <Divider sx={{ my: 1.5 }} />
                </>
              )}

              {/* Watch status & household reach */}
              <SectionHeader titleKey="filterPopper.sections.libraryAudience" section="audience" />
              <Collapse in={expandedSections.audience}>
                <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                      {t('filterPopper.watchStatusCaption')}
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      fullWidth
                      value={filters.watchStatus}
                      onChange={(_, v: WatchStatusFilter | null) => {
                        if (v !== null) onChange({ ...filters, watchStatus: v })
                      }}
                    >
                      <ToggleButton value="any">{t('filterPopper.watchAny')}</ToggleButton>
                      <ToggleButton value="watched">{t('filterPopper.watchWatched')}</ToggleButton>
                      <ToggleButton value="unwatched">{t('filterPopper.watchUnwatched')}</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Box display="flex" gap={1}>
                    <TextField
                      label={t('filterPopper.minWatchers')}
                      type="number"
                      size="small"
                      fullWidth
                      inputProps={{ min: 0 }}
                      value={filters.minWatchers ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          minWatchers: parseOptionalInt(e.target.value),
                        })
                      }
                      helperText={t('filterPopper.watchersHelper')}
                    />
                    <TextField
                      label={t('filterPopper.maxWatchers')}
                      type="number"
                      size="small"
                      fullWidth
                      inputProps={{ min: 0 }}
                      value={filters.maxWatchers ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          maxWatchers: parseOptionalInt(e.target.value),
                        })
                      }
                    />
                  </Box>
                </Box>
              </Collapse>

              <Divider sx={{ my: 1.5 }} />

              {/* Movies: Runtime Section */}
              {type === 'movies' && ranges.runtime && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.runtime" section="runtime" />
                  <Collapse in={expandedSections.runtime}>
                    <Box sx={{ py: 1.5 }}>
                      <RangeSlider
                        label={t('filterPopper.duration')}
                        value={(filters as MovieFilters).runtimeRange}
                        onChange={(value) => onChange({ ...filters, runtimeRange: value })}
                        min={ranges.runtime.min}
                        max={ranges.runtime.max}
                        step={10}
                        formatValue={(v) => `${v} min`}
                      />
                    </Box>
                  </Collapse>
                  <Divider sx={{ my: 1.5 }} />
                </>
              )}

              {/* Movies: Quality Section */}
              {type === 'movies' && resolutions && resolutions.length > 0 && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.videoQuality" section="quality" />
                  <Collapse in={expandedSections.quality}>
                    <Box sx={{ py: 1.5 }}>
                      <ChipToggleGroup
                        label=""
                        options={resolutions.map((r) => ({
                          value: r.resolution,
                          label: r.resolution,
                          count: r.count,
                        }))}
                        selected={(filters as MovieFilters).resolutions}
                        onChange={(selected) => onChange({ ...filters, resolutions: selected })}
                      />
                    </Box>
                  </Collapse>
                </>
              )}

              {/* Series: Seasons Section */}
              {type === 'series' && ranges.seasons && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.seasons" section="runtime" />
                  <Collapse in={expandedSections.runtime}>
                    <Box sx={{ py: 1.5 }}>
                      <RangeSlider
                        label={t('filterPopper.numberOfSeasons')}
                        value={(filters as SeriesFilters).seasonsRange}
                        onChange={(value) => onChange({ ...filters, seasonsRange: value })}
                        min={ranges.seasons.min}
                        max={ranges.seasons.max}
                        step={1}
                      />
                    </Box>
                  </Collapse>
                  <Divider sx={{ my: 1.5 }} />
                </>
              )}

              {/* Series: Status Section */}
              {type === 'series' && (
                <>
                  <SectionHeader titleKey="filterPopper.sections.status" section="status" />
                  <Collapse in={expandedSections.status}>
                    <Box sx={{ py: 1.5 }}>
                      <ChipToggleGroup
                        label=""
                        options={[
                          { value: 'Continuing', label: t('filterPopper.seriesAiring') },
                          { value: 'Ended', label: t('filterPopper.seriesEnded') },
                        ]}
                        selected={(filters as SeriesFilters).status}
                        onChange={(selected) => onChange({ ...filters, status: selected })}
                      />
                    </Box>
                  </Collapse>
                </>
              )}
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  )
}
