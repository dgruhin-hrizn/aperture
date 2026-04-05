import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Chip,
  OutlinedInput,
  Collapse,
  IconButton,
  Button,
  useTheme,
  useMediaQuery,
  Stack,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import ClearIcon from '@mui/icons-material/Clear'
import type { DiscoveryFilterOptions } from '../types'

/** ISO 639-1 codes for the language filter (labels via Intl.DisplayNames in UI locale). */
const FILTER_LANGUAGE_CODES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh',
  'hi',
  'ru',
  'ar',
  'th',
  'tr',
  'pl',
  'nl',
  'sv',
  'da',
  'no',
  'fi',
] as const

function languageLabelForCode(code: string, displayNames: Intl.DisplayNames): string {
  try {
    return displayNames.of(code) ?? code
  } catch {
    return code
  }
}

interface DiscoveryFiltersProps {
  filters: DiscoveryFilterOptions
  onFiltersChange: (filters: DiscoveryFilterOptions) => void
  yearRange?: { min: number; max: number }
  /** TMDb genres for the active tab (movie vs TV), localized via API */
  genreOptions: { id: number; name: string }[]
  genresLoading?: boolean
}

export function DiscoveryFilters({
  filters,
  onFiltersChange,
  yearRange,
  genreOptions,
  genresLoading,
}: DiscoveryFiltersProps) {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [expanded, setExpanded] = React.useState(false)

  const languageDisplayNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language]
  )
  
  const currentYear = new Date().getFullYear()
  const minYear = yearRange?.min ?? 1950
  const maxYear = yearRange?.max ?? currentYear

  const hasActiveFilters = (filters.languages && filters.languages.length > 0) ||
    (filters.genreIds && filters.genreIds.length > 0) ||
    filters.yearStart !== undefined ||
    filters.yearEnd !== undefined ||
    (filters.minSimilarity !== undefined && filters.minSimilarity > 0)

  const clearFilters = () => {
    onFiltersChange({})
  }

  const handleLanguageChange = (event: any) => {
    const value = event.target.value as string[]
    onFiltersChange({
      ...filters,
      languages: value.length > 0 ? value : undefined,
    })
  }

  const handleGenreChange = (event: any) => {
    const value = event.target.value as number[]
    onFiltersChange({
      ...filters,
      genreIds: value.length > 0 ? value : undefined,
    })
  }

  const handleYearRangeChange = (_event: Event, value: number | number[]) => {
    const [start, end] = value as number[]
    onFiltersChange({
      ...filters,
      yearStart: start === minYear ? undefined : start,
      yearEnd: end === maxYear ? undefined : end,
    })
  }

  const handleSimilarityChange = (_event: Event, value: number | number[]) => {
    const sim = value as number
    onFiltersChange({
      ...filters,
      minSimilarity: sim === 0 ? undefined : sim / 100,
    })
  }

  const handleIncludeUnknownLanguageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      includeUnknownLanguage: event.target.checked,
    })
  }

  const activeFilterCount = [
    filters.languages?.length ?? 0,
    filters.genreIds?.length ?? 0,
    (filters.yearStart !== undefined || filters.yearEnd !== undefined) ? 1 : 0,
    (filters.minSimilarity && filters.minSimilarity > 0) ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Button
          variant={hasActiveFilters ? 'contained' : 'outlined'}
          size="small"
          startIcon={<FilterListIcon />}
          onClick={() => setExpanded(!expanded)}
          sx={{
            bgcolor: hasActiveFilters ? 'primary.main' : 'transparent',
          }}
        >
          {t('discovery.filters.button')}
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{
                ml: 1,
                height: 20,
                minWidth: 20,
                bgcolor: hasActiveFilters ? 'rgba(255,255,255,0.2)' : 'primary.main',
                color: 'white',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Button>
        
        {hasActiveFilters && (
          <IconButton size="small" onClick={clearFilters} title={t('discovery.filters.clearAll')}>
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
          >
            {/* Language Filter */}
            <Box sx={{ flex: isMobile ? 1 : '0 0 auto' }}>
              <FormControl size="small" sx={{ minWidth: 150, width: '100%' }}>
                <InputLabel id="language-filter-label">{t('discovery.filters.language')}</InputLabel>
                <Select
                  labelId="language-filter-label"
                  multiple
                  value={filters.languages || []}
                  onChange={handleLanguageChange}
                  input={<OutlinedInput label={t('discovery.filters.language')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((code) => (
                        <Chip
                          key={code}
                          label={languageLabelForCode(code, languageDisplayNames)}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                >
                  {FILTER_LANGUAGE_CODES.map((code) => (
                    <MenuItem key={code} value={code}>
                      {languageLabelForCode(code, languageDisplayNames)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* Include Unknown Language checkbox - only show when language filter is active */}
              {filters.languages && filters.languages.length > 0 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.includeUnknownLanguage !== false}
                      onChange={handleIncludeUnknownLanguageChange}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary">
                      {t('discovery.filters.includeUnknown')}
                    </Typography>
                  }
                  sx={{ mt: 0.5, ml: 0 }}
                />
              )}
            </Box>

            {/* Genre Filter */}
            <FormControl size="small" sx={{ minWidth: 150, flex: isMobile ? 1 : '0 0 auto' }}>
              <InputLabel id="genre-filter-label">{t('discovery.filters.genre')}</InputLabel>
              <Select
                labelId="genre-filter-label"
                multiple
                value={filters.genreIds || []}
                onChange={handleGenreChange}
                input={<OutlinedInput label={t('discovery.filters.genre')} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const genre = genreOptions.find((g) => g.id === id)
                      return <Chip key={id} label={genre?.name || id} size="small" />
                    })}
                  </Box>
                )}
                disabled={genresLoading}
              >
                {genreOptions.map((genre) => (
                  <MenuItem key={genre.id} value={genre.id}>
                    {genre.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Year Range Slider */}
            <Box sx={{ minWidth: 200, flex: isMobile ? 1 : '0 0 auto', px: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {t('discovery.filters.yearRange')}
              </Typography>
              <Slider
                value={[filters.yearStart ?? minYear, filters.yearEnd ?? maxYear]}
                onChange={handleYearRangeChange}
                min={minYear}
                max={maxYear}
                valueLabelDisplay="auto"
                size="small"
                sx={{ mt: 0.5 }}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {filters.yearStart ?? minYear}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filters.yearEnd ?? maxYear}
                </Typography>
              </Box>
            </Box>

            {/* Similarity Threshold Slider */}
            <Box sx={{ minWidth: 200, flex: isMobile ? 1 : '0 0 auto', px: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {t('discovery.filters.minTasteMatch')}
              </Typography>
              <Slider
                value={(filters.minSimilarity ?? 0) * 100}
                onChange={handleSimilarityChange}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                size="small"
                sx={{ mt: 0.5 }}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {t('discovery.filters.any')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filters.minSimilarity
                    ? `${Math.round(filters.minSimilarity * 100)}%`
                    : t('discovery.filters.any')}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}
