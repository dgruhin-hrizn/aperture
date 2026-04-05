import { useState, useEffect, useCallback, useMemo, type HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  IconButton,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import CategoryIcon from '@mui/icons-material/Category'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

const MAX_ROWS = 24
const MAX_GENRES_PER_ROW = 8
const MAX_EXCLUDE_GENRES_PER_ROW = 8
const DEFAULT_ROW_LIMIT = 24
const MIN_ROW_LIMIT = 1
const MAX_ROW_LIMIT = 48
const MAX_ROW_LABEL_LENGTH = 80

export interface GenreOption {
  id: number
  name: string
}

interface GenreRowState {
  /** Stable id for React keys and drag-and-drop (not persisted). */
  rowId: string
  genreIds: number[]
  /** TMDb `without_genres` for this strip. */
  excludeGenreIds: number[]
  limit: number
  label: string
  originCountry: string
  /** Inclusive year bounds for Discover (optional). */
  yearStart?: number
  yearEnd?: number
  /** Rolling end at the current calendar year (mutually exclusive with a fixed yearEnd). */
  yearEndCurrent?: boolean
}

function newRowId(): string {
  return crypto.randomUUID()
}

export interface CountryOption {
  iso: string
  name: string
}

function clampRowLimit(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_ROW_LIMIT
  const x = Math.floor(n)
  return Math.min(MAX_ROW_LIMIT, Math.max(MIN_ROW_LIMIT, x))
}

const STRIP_YEAR_MIN = 1900
const STRIP_YEAR_MAX = 2100

function clampStripYear(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined
  const y = Math.floor(n)
  if (y < STRIP_YEAR_MIN || y > STRIP_YEAR_MAX) return undefined
  return y
}

function idsToGenreOptions(ids: number[], catalog: GenreOption[]): GenreOption[] {
  const byId = new Map(catalog.map((g) => [g.id, g] as const))
  return ids.map((id) => byId.get(id) ?? { id, name: `ID ${id}` })
}

function sanitizeRowLabel(s: string): string | undefined {
  const t = s.trim().slice(0, MAX_ROW_LABEL_LENGTH)
  return t === '' ? undefined : t
}

function sanitizeRowOriginCountry(s: string): string | undefined {
  const t = s.trim().toUpperCase()
  if (t === '') return undefined
  if (!/^[A-Z]{2}$/.test(t)) return undefined
  return t
}

function normalizeRowsForSave(
  rows: GenreRowState[]
): {
  genreIds: number[]
  limit: number
  label?: string
  originCountry?: string
  excludeGenreIds?: number[]
  yearStart?: number
  yearEnd?: number
  yearEndCurrent?: boolean
}[] {
  return rows
    .filter((r) => r.genreIds.length > 0)
    .map((r) => {
      const lim = clampRowLimit(r.limit)
      const label = sanitizeRowLabel(r.label)
      const originCountry = sanitizeRowOriginCountry(r.originCountry)
      const genreSet = new Set(r.genreIds)
      const excludeGenreIds = r.excludeGenreIds
        .filter((id) => !genreSet.has(id))
        .slice(0, MAX_EXCLUDE_GENRES_PER_ROW)
      const base: {
        genreIds: number[]
        limit: number
        label?: string
        originCountry?: string
        excludeGenreIds?: number[]
        yearStart?: number
        yearEnd?: number
        yearEndCurrent?: boolean
      } = {
        genreIds: r.genreIds,
        limit: lim,
      }
      if (label) base.label = label
      if (originCountry) base.originCountry = originCountry
      if (excludeGenreIds.length > 0) base.excludeGenreIds = excludeGenreIds
      if (r.yearStart !== undefined) base.yearStart = r.yearStart
      if (r.yearEndCurrent) base.yearEndCurrent = true
      else if (r.yearEnd !== undefined) base.yearEnd = r.yearEnd
      return base
    })
}

/** Compare editable fields only (not rowId / list position). */
function rowEditorFieldsEqual(a: GenreRowState, b: GenreRowState): boolean {
  if (a.genreIds.length !== b.genreIds.length) return false
  if (!a.genreIds.every((id, i) => id === b.genreIds[i])) return false
  if (a.excludeGenreIds.length !== b.excludeGenreIds.length) return false
  if (!a.excludeGenreIds.every((id, i) => id === b.excludeGenreIds[i])) return false
  if (clampRowLimit(a.limit) !== clampRowLimit(b.limit)) return false
  if (a.label.trim() !== b.label.trim()) return false
  if (a.originCountry.trim().toUpperCase() !== b.originCountry.trim().toUpperCase()) return false
  if (a.yearStart !== b.yearStart) return false
  if (a.yearEnd !== b.yearEnd) return false
  if (!!a.yearEndCurrent !== !!b.yearEndCurrent) return false
  return true
}

function isRowDirty(row: GenreRowState, initialRows: GenreRowState[]): boolean {
  const initial = initialRows.find((r) => r.rowId === row.rowId)
  if (!initial) return true
  return !rowEditorFieldsEqual(row, initial)
}

function parseRowsFromApi(raw: unknown): GenreRowState[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (Array.isArray(item)) {
      return {
        rowId: newRowId(),
        genreIds: [...item],
        excludeGenreIds: [],
        limit: DEFAULT_ROW_LIMIT,
        label: '',
        originCountry: '',
      }
    }
    const o = item as {
      genreIds?: unknown
      limit?: unknown
      label?: unknown
      originCountry?: unknown
      excludeGenreIds?: unknown
      yearStart?: unknown
      yearEnd?: unknown
      yearEndCurrent?: unknown
    }
    const genreIds = Array.isArray(o.genreIds) ? [...o.genreIds] : []
    const excludeGenreIds = Array.isArray(o.excludeGenreIds)
      ? (o.excludeGenreIds as number[]).filter((n) => typeof n === 'number' && n >= 1)
      : []
    const limit =
      typeof o.limit === 'number' && o.limit >= 1
        ? clampRowLimit(o.limit)
        : DEFAULT_ROW_LIMIT
    const label = typeof o.label === 'string' ? o.label : ''
    const originCountry = typeof o.originCountry === 'string' ? o.originCountry : ''
    const yearStart = typeof o.yearStart === 'number' ? o.yearStart : undefined
    const yearEndCurrent = o.yearEndCurrent === true
    const yearEnd = yearEndCurrent ? undefined : typeof o.yearEnd === 'number' ? o.yearEnd : undefined
    return {
      rowId: newRowId(),
      genreIds,
      excludeGenreIds,
      limit,
      label,
      originCountry,
      yearStart,
      yearEnd,
      yearEndCurrent: yearEndCurrent ? true : undefined,
    }
  })
}

function cloneRowState(r: GenreRowState): GenreRowState {
  return {
    rowId: r.rowId,
    genreIds: [...r.genreIds],
    excludeGenreIds: [...r.excludeGenreIds],
    limit: r.limit,
    label: r.label,
    originCountry: r.originCountry,
    yearStart: r.yearStart,
    yearEnd: r.yearEnd,
    yearEndCurrent: r.yearEndCurrent,
  }
}

function countryOptionFor(iso: string, catalog: CountryOption[], anyLabel: string): CountryOption {
  if (!iso) return { iso: '', name: anyLabel }
  const f = catalog.find((c) => c.iso === iso)
  return f ?? { iso, name: iso }
}

type GenreStripRowCardProps = {
  row: GenreRowState
  rowIndex: number
  genreOptions: GenreOption[]
  countryOptions: CountryOption[]
  catalog: GenreOption[]
  searchPlaceholder: string
  onPatch: (patch: Partial<Omit<GenreRowState, 'rowId'>>) => void
  onRemove: () => void
  /** When set, shows a drag handle (listeners + attributes from @dnd-kit useSortable). */
  dragHandleProps?: HTMLAttributes<HTMLElement>
  /** When set, shows a save icon for unsaved field edits on this strip (persists the whole section). */
  stripSave?: { disabled: boolean; onClick: () => void }
  t: TFunction
}

function GenreStripRowCard({
  row,
  rowIndex,
  genreOptions,
  countryOptions,
  catalog,
  searchPlaceholder,
  onPatch,
  onRemove,
  dragHandleProps,
  stripSave,
  t,
}: GenreStripRowCardProps) {
  const countryAny = t('settingsDiscoveryGenreStrips.countryAny')
  const countryAutocompleteOptions = useMemo(() => {
    const anyOpt: CountryOption = { iso: '', name: countryAny }
    const sorted = [...countryOptions].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
    return [anyOpt, ...sorted]
  }, [countryOptions, countryAny])

  const yearEndMode: 'none' | 'current' | 'fixed' = row.yearEndCurrent
    ? 'current'
    : row.yearEnd !== undefined
      ? 'fixed'
      : 'none'

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        borderColor: 'divider',
      }}
    >
      <Stack spacing={1.25}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
          <Box display="flex" alignItems="center" gap={0.25} minWidth={0}>
            {dragHandleProps ? (
              <Box
                component="button"
                type="button"
                {...dragHandleProps}
                aria-label={t('settingsDiscoveryGenreStrips.reorderStrip')}
                sx={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0.5,
                  m: 0,
                  border: 'none',
                  borderRadius: 1,
                  bgcolor: 'transparent',
                  color: 'action.active',
                  cursor: 'grab',
                  touchAction: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: (theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>
            ) : null}
            <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.5}>
              {t('settingsDiscoveryGenreStrips.stripIndex', { n: rowIndex + 1 })}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.25}>
            {stripSave ? (
              <IconButton
                type="button"
                aria-label={t('settingsDiscoveryGenreStrips.saveStrip')}
                onClick={stripSave.onClick}
                disabled={stripSave.disabled}
                size="small"
                color="primary"
              >
                {stripSave.disabled ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon fontSize="small" />
                )}
              </IconButton>
            ) : null}
            <IconButton
              aria-label={t('settingsDiscoveryGenreStrips.removeRow')}
              onClick={onRemove}
              size="small"
              sx={{ mr: -0.5 }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box
          display="flex"
          flexDirection={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1}
        >
          <Autocomplete
            multiple
            sx={{ flex: 1, minWidth: 0 }}
            options={genreOptions.filter((g) => !row.excludeGenreIds.includes(g.id))}
            value={idsToGenreOptions(row.genreIds, catalog)}
            onChange={(_, newValue) => {
              const genreIds = newValue.slice(0, MAX_GENRES_PER_ROW).map((g) => g.id)
              onPatch({
                genreIds,
                excludeGenreIds: row.excludeGenreIds.filter((id) => !genreIds.includes(id)),
              })
            }}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={(o) => o.name}
            filterSelectedOptions
            disableCloseOnSelect
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  size="small"
                  label={option.name}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('settingsDiscoveryGenreStrips.fieldGenres')}
                placeholder={searchPlaceholder}
                size="small"
              />
            )}
          />
          <TextField
            type="number"
            label={t('settingsDiscoveryGenreStrips.fieldMaxTitles')}
            value={row.limit}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              onPatch({ limit: Number.isFinite(v) ? v : row.limit })
            }}
            onBlur={() => onPatch({ limit: clampRowLimit(row.limit) })}
            inputProps={{ min: MIN_ROW_LIMIT, max: MAX_ROW_LIMIT }}
            sx={{ width: { xs: '100%', sm: 100 }, flexShrink: 0 }}
            size="small"
          />
        </Box>

        <Autocomplete
          multiple
          options={genreOptions.filter((g) => !row.genreIds.includes(g.id))}
          value={idsToGenreOptions(row.excludeGenreIds, catalog)}
          onChange={(_, newValue) => {
            const excludeGenreIds = newValue.slice(0, MAX_EXCLUDE_GENRES_PER_ROW).map((g) => g.id)
            onPatch({
              excludeGenreIds,
              genreIds: row.genreIds.filter((id) => !excludeGenreIds.includes(id)),
            })
          }}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          getOptionLabel={(o) => o.name}
          filterSelectedOptions
          disableCloseOnSelect
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option.id} size="small" label={option.name} />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('settingsDiscoveryGenreStrips.fieldExcludeGenres')}
              placeholder={t('settingsDiscoveryGenreStrips.searchPlaceholder')}
              size="small"
              helperText={t('settingsDiscoveryGenreStrips.fieldExcludeGenresHelper')}
            />
          )}
        />

        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
          gap={1.25}
        >
          <TextField
            type="number"
            label={t('settingsDiscoveryGenreStrips.fieldYearStart')}
            value={row.yearStart ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onPatch({ yearStart: undefined })
                return
              }
              const v = parseInt(raw, 10)
              onPatch({ yearStart: Number.isFinite(v) ? v : row.yearStart })
            }}
            onBlur={() => {
              const v = clampStripYear(row.yearStart)
              if (v !== row.yearStart) onPatch({ yearStart: v })
            }}
            inputProps={{ min: STRIP_YEAR_MIN, max: STRIP_YEAR_MAX }}
            fullWidth
            size="small"
          />
          <Box>
            <FormControl fullWidth size="small">
              <InputLabel id={`genre-strip-ye-${row.rowId}`}>
                {t('settingsDiscoveryGenreStrips.fieldYearEnd')}
              </InputLabel>
              <Select
                labelId={`genre-strip-ye-${row.rowId}`}
                label={t('settingsDiscoveryGenreStrips.fieldYearEnd')}
                value={yearEndMode}
                onChange={(e) => {
                  const v = e.target.value as 'none' | 'current' | 'fixed'
                  if (v === 'none') onPatch({ yearEnd: undefined, yearEndCurrent: false })
                  else if (v === 'current') onPatch({ yearEnd: undefined, yearEndCurrent: true })
                  else
                    onPatch({
                      yearEndCurrent: false,
                      yearEnd: row.yearEnd ?? new Date().getFullYear(),
                    })
                }}
              >
                <MenuItem value="none">{t('settingsDiscoveryGenreStrips.fieldYearEndOptionNone')}</MenuItem>
                <MenuItem value="current">{t('settingsDiscoveryGenreStrips.fieldYearEndOptionToday')}</MenuItem>
                <MenuItem value="fixed">{t('settingsDiscoveryGenreStrips.fieldYearEndOptionFixed')}</MenuItem>
              </Select>
            </FormControl>
            {yearEndMode === 'fixed' ? (
              <TextField
                type="number"
                label={t('settingsDiscoveryGenreStrips.fieldYearEndFixed')}
                value={row.yearEnd ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    onPatch({ yearEnd: undefined })
                    return
                  }
                  const v = parseInt(raw, 10)
                  onPatch({ yearEnd: Number.isFinite(v) ? v : row.yearEnd })
                }}
                onBlur={() => {
                  const v = clampStripYear(row.yearEnd)
                  if (v !== row.yearEnd) onPatch({ yearEnd: v })
                }}
                inputProps={{ min: STRIP_YEAR_MIN, max: STRIP_YEAR_MAX }}
                fullWidth
                size="small"
                sx={{ mt: 1 }}
              />
            ) : null}
          </Box>
        </Box>

        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
          gap={1.25}
        >
          <TextField
            label={t('settingsDiscoveryGenreStrips.fieldHeading')}
            placeholder={t('settingsDiscoveryGenreStrips.fieldHeadingPlaceholder')}
            value={row.label}
            onChange={(e) => {
              onPatch({ label: e.target.value.slice(0, MAX_ROW_LABEL_LENGTH) })
            }}
            fullWidth
            size="small"
          />
          <Autocomplete
            options={countryAutocompleteOptions}
            value={countryOptionFor(row.originCountry, countryOptions, countryAny)}
            onChange={(_, v) => {
              onPatch({ originCountry: v?.iso ?? '' })
            }}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.iso === b.iso}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('settingsDiscoveryGenreStrips.fieldCountry')}
                placeholder={t('settingsDiscoveryGenreStrips.fieldCountryPlaceholder')}
                size="small"
              />
            )}
          />
        </Box>
      </Stack>
    </Paper>
  )
}

type SortableGenreStripRowCardProps = Omit<GenreStripRowCardProps, 'dragHandleProps'> & {
  sortableId: string
}

function SortableGenreStripRowCard({ sortableId, ...props }: SortableGenreStripRowCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 2 : undefined,
    position: 'relative' as const,
  }
  return (
    <Box ref={setNodeRef} style={style}>
      <GenreStripRowCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </Box>
  )
}

export function DiscoveryGenreStripsSettings() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [savingMovie, setSavingMovie] = useState(false)
  const [savingTv, setSavingTv] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [genresLoadError, setGenresLoadError] = useState(false)
  const [countriesLoadError, setCountriesLoadError] = useState(false)

  const [movieCatalog, setMovieCatalog] = useState<GenreOption[]>([])
  const [tvCatalog, setTvCatalog] = useState<GenreOption[]>([])
  const [countryCatalog, setCountryCatalog] = useState<CountryOption[]>([])

  const [movieRows, setMovieRows] = useState<GenreRowState[]>([])
  const [tvRows, setTvRows] = useState<GenreRowState[]>([])
  const [initialMovieRows, setInitialMovieRows] = useState<GenreRowState[]>([])
  const [initialTvRows, setInitialTvRows] = useState<GenreRowState[]>([])

  const movieAutocompleteOptions = useMemo(() => {
    const byId = new Map(movieCatalog.map((g) => [g.id, g] as const))
    for (const row of movieRows) {
      for (const id of row.genreIds) {
        if (!byId.has(id)) byId.set(id, { id, name: `ID ${id}` })
      }
      for (const id of row.excludeGenreIds) {
        if (!byId.has(id)) byId.set(id, { id, name: `ID ${id}` })
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }, [movieCatalog, movieRows])

  const tvAutocompleteOptions = useMemo(() => {
    const byId = new Map(tvCatalog.map((g) => [g.id, g] as const))
    for (const row of tvRows) {
      for (const id of row.genreIds) {
        if (!byId.has(id)) byId.set(id, { id, name: `ID ${id}` })
      }
      for (const id of row.excludeGenreIds) {
        if (!byId.has(id)) byId.set(id, { id, name: `ID ${id}` })
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }, [tvCatalog, tvRows])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const applyGenreStripsResponse = useCallback(
    (data: { movieGenreRows?: unknown; seriesGenreRows?: unknown }) => {
      const m = parseRowsFromApi(data.movieGenreRows)
      const s = parseRowsFromApi(data.seriesGenreRows)
      setMovieRows(m.map(cloneRowState))
      setTvRows(s.map(cloneRowState))
      setInitialMovieRows(m.map(cloneRowState))
      setInitialTvRows(s.map(cloneRowState))
    },
    []
  )

  const persistMovieRows = useCallback(
    async (rows: GenreRowState[], opts?: { silent?: boolean }) => {
      const movieGenreRows = normalizeRowsForSave(rows)
      setSavingMovie(true)
      setError(null)
      if (!opts?.silent) setSuccess(null)
      try {
        const res = await fetch('/api/settings/discovery-genre-strips', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ movieGenreRows }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setError(body.error ?? t('settingsDiscoveryGenreStrips.saveError'))
          return
        }
        const data = (await res.json()) as {
          movieGenreRows?: unknown
          seriesGenreRows?: unknown
        }
        applyGenreStripsResponse(data)
        if (!opts?.silent) setSuccess(t('settingsDiscoveryGenreStrips.saved'))
      } catch {
        setError(t('settingsDiscoveryGenreStrips.saveError'))
      } finally {
        setSavingMovie(false)
      }
    },
    [applyGenreStripsResponse, t]
  )

  const persistTvRows = useCallback(
    async (rows: GenreRowState[], opts?: { silent?: boolean }) => {
      const seriesGenreRows = normalizeRowsForSave(rows)
      setSavingTv(true)
      setError(null)
      if (!opts?.silent) setSuccess(null)
      try {
        const res = await fetch('/api/settings/discovery-genre-strips', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ seriesGenreRows }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          setError(body.error ?? t('settingsDiscoveryGenreStrips.saveError'))
          return
        }
        const data = (await res.json()) as {
          movieGenreRows?: unknown
          seriesGenreRows?: unknown
        }
        applyGenreStripsResponse(data)
        if (!opts?.silent) setSuccess(t('settingsDiscoveryGenreStrips.saved'))
      } catch {
        setError(t('settingsDiscoveryGenreStrips.saveError'))
      } finally {
        setSavingTv(false)
      }
    },
    [applyGenreStripsResponse, t]
  )

  const onMovieStripsDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setMovieRows((prev) => {
        const oldIndex = prev.findIndex((r) => r.rowId === active.id)
        const newIndex = prev.findIndex((r) => r.rowId === over.id)
        if (oldIndex < 0 || newIndex < 0) return prev
        const next = arrayMove(prev, oldIndex, newIndex)
        queueMicrotask(() => void persistMovieRows(next, { silent: true }))
        return next
      })
    },
    [persistMovieRows]
  )

  const onTvStripsDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setTvRows((prev) => {
        const oldIndex = prev.findIndex((r) => r.rowId === active.id)
        const newIndex = prev.findIndex((r) => r.rowId === over.id)
        if (oldIndex < 0 || newIndex < 0) return prev
        const next = arrayMove(prev, oldIndex, newIndex)
        queueMicrotask(() => void persistTvRows(next, { silent: true }))
        return next
      })
    },
    [persistTvRows]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setGenresLoadError(false)
    setCountriesLoadError(false)
    const locale = i18n.language || 'en'
    try {
      const [optRes, settingsRes, countryRes] = await Promise.all([
        fetch(`/api/settings/discovery-genre-strips/genre-options?locale=${encodeURIComponent(locale)}`, {
          credentials: 'include',
        }),
        fetch('/api/settings/discovery-genre-strips', { credentials: 'include' }),
        fetch(
          `/api/settings/discovery-genre-strips/country-options?locale=${encodeURIComponent(locale)}`,
          { credentials: 'include' }
        ),
      ])

      let movieGenresList: GenreOption[] = []
      let tvGenresList: GenreOption[] = []
      if (optRes.ok) {
        const optData = (await optRes.json()) as {
          movieGenres?: GenreOption[]
          tvGenres?: GenreOption[]
        }
        movieGenresList = Array.isArray(optData.movieGenres) ? optData.movieGenres : []
        tvGenresList = Array.isArray(optData.tvGenres) ? optData.tvGenres : []
        setMovieCatalog(movieGenresList)
        setTvCatalog(tvGenresList)
      } else {
        setGenresLoadError(true)
        setMovieCatalog([])
        setTvCatalog([])
      }

      if (countryRes.ok) {
        const cData = (await countryRes.json()) as { countries?: { iso: string; name: string }[] }
        setCountryCatalog(
          Array.isArray(cData.countries)
            ? cData.countries.map((c) => ({ iso: c.iso, name: c.name }))
            : []
        )
      } else {
        setCountriesLoadError(true)
        setCountryCatalog([])
      }

      if (!settingsRes.ok) {
        setError(t('settingsDiscoveryGenreStrips.loadError'))
        return
      }
      const data = (await settingsRes.json()) as {
        movieGenreRows?: unknown
        seriesGenreRows?: unknown
      }
      const m = parseRowsFromApi(data.movieGenreRows)
      const s = parseRowsFromApi(data.seriesGenreRows)

      setMovieRows(m.map(cloneRowState))
      setTvRows(s.map(cloneRowState))
      setInitialMovieRows(m.map(cloneRowState))
      setInitialTvRows(s.map(cloneRowState))
    } catch {
      setError(t('settingsDiscoveryGenreStrips.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t, i18n.language])

  useEffect(() => {
    void load()
  }, [load])

  const emptyRow = (): GenreRowState => ({
    rowId: newRowId(),
    genreIds: [],
    excludeGenreIds: [],
    limit: DEFAULT_ROW_LIMIT,
    label: '',
    originCountry: '',
  })

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent sx={{ pt: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <CategoryIcon color="primary" />
          <Typography variant="h6" component="h2">
            {t('settingsDiscoveryGenreStrips.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settingsDiscoveryGenreStrips.description')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {genresLoadError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('settingsDiscoveryGenreStrips.genresLoadWarning')}
          </Alert>
        )}
        {countriesLoadError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('settingsDiscoveryGenreStrips.countriesLoadWarning')}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Typography variant="subtitle1" sx={{ mt: 1, mb: 0.5 }} fontWeight={600}>
          {t('settingsDiscoveryGenreStrips.movieSection')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('settingsDiscoveryGenreStrips.movieSectionHint')}
        </Typography>
        <Stack spacing={1.25}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onMovieStripsDragEnd}
          >
            <SortableContext
              items={movieRows.map((r) => r.rowId)}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={1.25}>
                {movieRows.map((row, rowIndex) => (
                  <SortableGenreStripRowCard
                    key={row.rowId}
                    sortableId={row.rowId}
                    row={row}
                    rowIndex={rowIndex}
                    genreOptions={movieAutocompleteOptions}
                    countryOptions={countryCatalog}
                    catalog={movieCatalog}
                    searchPlaceholder={t('settingsDiscoveryGenreStrips.searchPlaceholder')}
                    onPatch={(patch) => {
                      setMovieRows((prev) => {
                        const next = [...prev]
                        next[rowIndex] = { ...next[rowIndex], ...patch }
                        return next
                      })
                    }}
                    onRemove={() => setMovieRows((prev) => prev.filter((_, i) => i !== rowIndex))}
                    stripSave={
                      isRowDirty(row, initialMovieRows)
                        ? {
                            disabled: savingMovie,
                            onClick: () => void persistMovieRows(movieRows),
                          }
                        : undefined
                    }
                    t={t}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={movieRows.length >= MAX_ROWS || savingMovie}
            onClick={() => setMovieRows((prev) => [...prev, emptyRow()])}
          >
            {t('settingsDiscoveryGenreStrips.addRow')}
          </Button>
        </Stack>

        <Typography variant="subtitle1" sx={{ mt: 3, mb: 0.5 }} fontWeight={600}>
          {t('settingsDiscoveryGenreStrips.tvSection')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('settingsDiscoveryGenreStrips.tvSectionHint')}
        </Typography>
        <Stack spacing={1.25}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onTvStripsDragEnd}
          >
            <SortableContext
              items={tvRows.map((r) => r.rowId)}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={1.25}>
                {tvRows.map((row, rowIndex) => (
                  <SortableGenreStripRowCard
                    key={row.rowId}
                    sortableId={row.rowId}
                    row={row}
                    rowIndex={rowIndex}
                    genreOptions={tvAutocompleteOptions}
                    countryOptions={countryCatalog}
                    catalog={tvCatalog}
                    searchPlaceholder={t('settingsDiscoveryGenreStrips.searchPlaceholder')}
                    onPatch={(patch) => {
                      setTvRows((prev) => {
                        const next = [...prev]
                        next[rowIndex] = { ...next[rowIndex], ...patch }
                        return next
                      })
                    }}
                    onRemove={() => setTvRows((prev) => prev.filter((_, i) => i !== rowIndex))}
                    stripSave={
                      isRowDirty(row, initialTvRows)
                        ? {
                            disabled: savingTv,
                            onClick: () => void persistTvRows(tvRows),
                          }
                        : undefined
                    }
                    t={t}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={tvRows.length >= MAX_ROWS || savingTv}
            onClick={() => setTvRows((prev) => [...prev, emptyRow()])}
          >
            {t('settingsDiscoveryGenreStrips.addRow')}
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          {t('settingsDiscoveryGenreStrips.footerNote')}
        </Typography>
      </CardContent>
    </Card>
  )
}
