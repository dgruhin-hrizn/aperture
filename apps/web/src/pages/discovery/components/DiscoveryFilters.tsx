import React from 'react'
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

// Common language codes with display names
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
]

// TMDb genre IDs (common for both movies and TV)
const GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
]

interface DiscoveryFiltersProps {
  filters: DiscoveryFilterOptions
  onFiltersChange: (filters: DiscoveryFilterOptions) => void
  yearRange?: { min: number; max: number }
}

export function DiscoveryFilters({ filters, onFiltersChange, yearRange }: DiscoveryFiltersProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [expanded, setExpanded] = React.useState(false)
  
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
          Filters
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
          <IconButton size="small" onClick={clearFilters} title="Clear all filters">
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
                <InputLabel id="language-filter-label">Language</InputLabel>
                <Select
                  labelId="language-filter-label"
                  multiple
                  value={filters.languages || []}
                  onChange={handleLanguageChange}
                  input={<OutlinedInput label="Language" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((code) => {
                        const lang = LANGUAGES.find(l => l.code === code)
                        return <Chip key={code} label={lang?.name || code} size="small" />
                      })}
                    </Box>
                  )}
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
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
                      Include unknown
                    </Typography>
                  }
                  sx={{ mt: 0.5, ml: 0 }}
                />
              )}
            </Box>

            {/* Genre Filter */}
            <FormControl size="small" sx={{ minWidth: 150, flex: isMobile ? 1 : '0 0 auto' }}>
              <InputLabel id="genre-filter-label">Genre</InputLabel>
              <Select
                labelId="genre-filter-label"
                multiple
                value={filters.genreIds || []}
                onChange={handleGenreChange}
                input={<OutlinedInput label="Genre" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const genre = GENRES.find(g => g.id === id)
                      return <Chip key={id} label={genre?.name || id} size="small" />
                    })}
                  </Box>
                )}
              >
                {GENRES.map((genre) => (
                  <MenuItem key={genre.id} value={genre.id}>
                    {genre.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Year Range Slider */}
            <Box sx={{ minWidth: 200, flex: isMobile ? 1 : '0 0 auto', px: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Year Range
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
                Min Taste Match
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
                  Any
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filters.minSimilarity ? `${Math.round(filters.minSimilarity * 100)}%` : 'Any'}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}
