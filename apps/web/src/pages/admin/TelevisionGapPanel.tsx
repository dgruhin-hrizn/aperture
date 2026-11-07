import { useEffect, useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Chip,
  CircularProgress, Stack, TextField, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'

interface SeriesOption {
  id: string
  title: string
  year: number | null
}

interface GapReport {
  title: string
  checkedAt: string
  seasons: Array<{
    number: number
    name: string
    released: number
    missing: Array<{ number: number; title: string; airDate: string }>
  }>
}

export function TelevisionGapPanel() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [options, setOptions] = useState<SeriesOption[]>([])
  const [selected, setSelected] = useState<SeriesOption | null>(null)
  const [report, setReport] = useState<GapReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endpoint = '/api/admin/gap-analysis/tv'

  useEffect(() => {
    const text = input.trim()
    if (text.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(text)}`, { signal: controller.signal })
        if (!response.ok) throw new Error()
        const { series } = await response.json() as { series: SeriesOption[] }
        if (!controller.signal.aborted) setOptions(series)
      } catch {
        if (!controller.signal.aborted) setOptions([])
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [input])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    async function inspect(id: string) {
      try {
        const response = await fetch(`${endpoint}/${id}`, { signal: controller.signal })
        const data = await response.json()
        if (controller.signal.aborted) return
        if (response.ok) setReport(data as GapReport)
        else setError(data.error ?? t('admin.gaps.tv.checkFailed'))
      } catch {
        if (!controller.signal.aborted) setError(t('admin.gaps.tv.checkFailed'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void inspect(selected.id)
    return () => controller.abort()
  }, [selected, t])

  const gaps = report?.seasons.filter((season) => season.missing.length > 0) ?? []
  return (
    <Accordion disableGutters variant="outlined" sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={600}>{t('admin.gaps.tv.heading')}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">{t('admin.gaps.tv.description')}</Typography>
          <Autocomplete
            options={input.trim().length >= 2 ? options : []}
            value={selected}
            onChange={(_event, next) => {
              setSelected(next)
              setReport(null)
              setError(null)
              setLoading(!!next)
            }}
            onInputChange={(_event, value, reason) => {
              if (reason === 'input' || reason === 'clear') {
                setOptions([])
                setInput(value)
              }
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option.year ? `${option.title} (${option.year})` : option.title}
            filterOptions={(values) => values}
            renderInput={(params) => <TextField {...params} label={t('admin.gaps.tv.selectSeries')} />}
          />
          {loading && <CircularProgress size={24} aria-label={t('admin.gaps.tv.checking')} />}
          {error && <Alert severity="warning">{error}</Alert>}
          {report && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {t('admin.gaps.tv.checked', { when: new Date(report.checkedAt).toLocaleString() })}
              </Typography>
              {!gaps.length && <Alert severity="success">{t('admin.gaps.tv.none')}</Alert>}
              {gaps.map((season) => (
                <Accordion key={season.number} disableGutters variant="outlined">
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography>{season.name}</Typography>
                      <Chip size="small" label={season.missing.length === season.released
                        ? t('admin.gaps.tv.wholeSeason')
                        : t('admin.gaps.tv.episodeCount', { count: season.missing.length })} />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box component="ul" sx={{ my: 0, pl: 2 }}>
                      {season.missing.map((episode) => (
                        <li key={episode.number}>
                          <Typography variant="body2">{episode.number}. {episode.title} ({episode.airDate})</Typography>
                        </li>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
