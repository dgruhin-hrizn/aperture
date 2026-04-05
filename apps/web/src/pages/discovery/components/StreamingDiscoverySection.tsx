import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { DiscoveryCard } from './DiscoveryCard'
import { useSeerrRequest } from '../hooks/useSeerrRequest'
import type { DiscoveryCandidate, MediaType, SeerrMediaStatus, StreamingChartRow } from '../types'
import type { SeerrRequestOptions } from '../../../types/seerrRequest'
import type { ResolveDiscoveryGenreName } from '../hooks/useDiscoveryGenres'

const PLACEHOLDER_RUN_ID = '00000000-0000-0000-0000-000000000000'

function rowToCandidate(row: StreamingChartRow, index: number): DiscoveryCandidate {
  const mediaType: MediaType = row.objectType === 'MOVIE' ? 'movie' : 'series'
  return {
    id: `jw-${row.jwNodeId}`,
    runId: PLACEHOLDER_RUN_ID,
    userId: PLACEHOLDER_RUN_ID,
    mediaType,
    tmdbId: row.tmdbId ?? 0,
    imdbId: row.imdbId,
    rank: row.chartRank ?? index + 1,
    finalScore: 0,
    similarityScore: null,
    popularityScore: null,
    recencyScore: null,
    sourceScore: null,
    source: 'justwatch_streaming',
    sourceMediaId: null,
    title: row.title,
    originalTitle: null,
    originalLanguage: null,
    releaseYear: row.releaseYear,
    posterPath: row.posterPath,
    backdropPath: null,
    overview: row.overview,
    genres: [],
    voteAverage: null,
    voteCount: null,
    scoreBreakdown: {},
    castMembers: [],
    directors: [],
    runtimeMinutes: null,
    tagline: null,
    isEnriched: false,
    isDynamic: true,
    createdAt: new Date().toISOString(),
  }
}

const resolveGenrePassthrough: ResolveDiscoveryGenreName = (_id, name) => name ?? ''

function ChartTrendBadge({ trend }: { trend: string }) {
  const theme = useTheme()
  const u = trend.trim().toUpperCase()
  let Icon: typeof TrendingUpIcon = TrendingFlatIcon
  let mainColor = theme.palette.text.secondary
  let bgAlpha = 0.14

  if (u === 'DOWN' || u.startsWith('DOWN')) {
    Icon = TrendingDownIcon
    mainColor = theme.palette.error.main
  } else if (u === 'UP' || u.startsWith('UP')) {
    Icon = TrendingUpIcon
    mainColor = theme.palette.success.main
  } else if (u === 'STABLE' || u === 'FLAT' || u.includes('STABLE') || u.includes('FLAT')) {
    Icon = TrendingFlatIcon
    mainColor = theme.palette.info.main
  }

  return (
    <Tooltip title={trend}>
      <Box
        sx={{
          position: 'absolute',
          top: 6,
          left: 6,
          zIndex: 2,
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(mainColor, bgAlpha),
          border: '1px solid',
          borderColor: alpha(mainColor, 0.45),
          boxShadow: 1,
        }}
      >
        <Icon sx={{ fontSize: 17, color: mainColor }} />
      </Box>
    </Tooltip>
  )
}

interface StripState {
  title: string
  rows: StreamingChartRow[]
  seerrStatuses: Record<number, SeerrMediaStatus>
  error: string | null
  stale?: boolean
}

interface StripEntry {
  code: string
  title: string
  state: 'idle' | 'loading' | 'loaded'
  strip: StripState | null
}

function buildStreamingQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

function StripSkeletonRow() {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        overflow: 'hidden',
        pb: 1,
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          width={160}
          height={240}
          sx={{ flexShrink: 0, borderRadius: 2 }}
          animation="wave"
        />
      ))}
    </Box>
  )
}

function SearchStripSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden', pb: 1 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={160} height={240} sx={{ flexShrink: 0, borderRadius: 2 }} animation="wave" />
      ))}
    </Box>
  )
}

/** One provider strip: loads when scrolled into view; only enqueues while state is idle. */
function LazyProviderStripRow({
  entry,
  topMargin,
  onVisible,
  children,
}: {
  entry: StripEntry
  topMargin: number
  onVisible: (code: string) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (entry.state !== 'idle') return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) {
          onVisible(entry.code)
        }
      },
      { root: null, rootMargin: '180px 0px 200px 0px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [entry.code, entry.state, onVisible])

  return (
    <Box ref={ref} sx={{ mt: topMargin }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {entry.title}
      </Typography>
      {children}
    </Box>
  )
}

export function StreamingDiscoverySection({ requestEnabled }: { requestEnabled: boolean }) {
  const { t, i18n } = useTranslation()
  const language = useMemo(() => (i18n.language || 'en').split('-')[0] || 'en', [i18n.language])

  const [country, setCountry] = useState(() => {
    try {
      return localStorage.getItem('aperture_streaming_country') || 'US'
    } catch {
      return 'US'
    }
  })
  const [missingOnly, setMissingOnly] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [providerStrips, setProviderStrips] = useState<string[]>(['nfx', 'dnp', 'mxx'])

  const [stripEntries, setStripEntries] = useState<StripEntry[]>([])
  const [loadingLabels, setLoadingLabels] = useState(true)
  const [searchStrip, setSearchStrip] = useState<StripState | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [seerrLocal, setSeerrLocal] = useState<Record<number, Partial<SeerrMediaStatus>>>({})

  const stripEntriesRef = useRef(stripEntries)
  stripEntriesRef.current = stripEntries

  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const queuedRef = useRef<Set<string>>(new Set())

  const { submitRequest, isRequesting, fetchTVDetails } = useSeerrRequest()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(searchQ.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchQ])

  useEffect(() => {
    try {
      localStorage.setItem('aperture_streaming_country', country)
    } catch {
      /* ignore */
    }
  }, [country])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/discovery/streaming/config', { credentials: 'include' })
        if (res.ok) {
          const data = (await res.json()) as { providerStrips?: string[] }
          if (Array.isArray(data.providerStrips) && data.providerStrips.length > 0) {
            setProviderStrips(data.providerStrips)
          }
        }
      } catch {
        /* keep defaults */
      }
    })()
  }, [])

  const fetchOneStrip = useCallback(
    async (opts: { title: string; provider?: string; q?: string }): Promise<StripState> => {
      const base = {
        country: country.toUpperCase(),
        language,
        limit: '24',
        missingOnly: missingOnly ? 'true' : 'false',
      }
      const qs =
        opts.q !== undefined
          ? buildStreamingQuery({ ...base, q: opts.q })
          : buildStreamingQuery({ ...base, provider: opts.provider })
      const path = opts.q !== undefined ? '/api/discovery/streaming/search' : '/api/discovery/streaming/popular'
      const res = await fetch(`${path}${qs}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return {
          title: opts.title,
          rows: [],
          seerrStatuses: {},
          error: typeof err.error === 'string' ? err.error : t('discoveryStreaming.loadError'),
        }
      }
      const data = (await res.json()) as {
        rows: StreamingChartRow[]
        stale?: boolean
        seerrStatuses?: Record<number, SeerrMediaStatus>
      }
      return {
        title: opts.title,
        rows: data.rows || [],
        seerrStatuses: (data.seerrStatuses || {}) as Record<number, SeerrMediaStatus>,
        error: null,
        stale: data.stale,
      }
    },
    [country, language, missingOnly, t]
  )

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    const code = queueRef.current.shift()
    if (!code) return
    processingRef.current = true
    queuedRef.current.delete(code)

    const title = stripEntriesRef.current.find((e) => e.code === code)?.title ?? code
    setStripEntries((prev) => prev.map((e) => (e.code === code ? { ...e, state: 'loading' } : e)))

    try {
      const strip = await fetchOneStrip({ title, provider: code })
      setStripEntries((prev) =>
        prev.map((e) => (e.code === code ? { ...e, state: 'loaded', strip } : e))
      )
    } catch {
      setStripEntries((prev) =>
        prev.map((e) =>
          e.code === code
            ? {
                ...e,
                state: 'loaded',
                strip: {
                  title,
                  rows: [],
                  seerrStatuses: {},
                  error: t('discoveryStreaming.loadError'),
                },
              }
            : e
        )
      )
    } finally {
      processingRef.current = false
      void processQueue()
    }
  }, [fetchOneStrip, t])

  const enqueueLoad = useCallback(
    (code: string) => {
      const entry = stripEntriesRef.current.find((e) => e.code === code)
      if (!entry || entry.state !== 'idle') return
      if (queuedRef.current.has(code)) return
      queuedRef.current.add(code)
      queueRef.current.push(code)
      void processQueue()
    },
    [processQueue]
  )

  useEffect(() => {
    let cancelled = false
    queueRef.current = []
    queuedRef.current = new Set()
    processingRef.current = false
    setStripEntries([])
    setLoadingLabels(true)

    void (async () => {
      const labelMap = new Map<string, string>()
      try {
        const res = await fetch(
          `/api/discovery/streaming/providers${buildStreamingQuery({ country: country.toUpperCase() })}`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const data = (await res.json()) as {
            providers?: Array<{ technicalName: string; shortName?: string; clearName?: string }>
          }
          for (const p of data.providers || []) {
            const label = (p.clearName || p.shortName || p.technicalName).trim()
            const register = (key: string | undefined) => {
              if (!key) return
              labelMap.set(key.toLowerCase(), label)
            }
            register(p.technicalName)
            register(p.shortName)
          }
        }
      } catch {
        /* keep empty map */
      }
      if (cancelled) return

      const next: StripEntry[] = providerStrips.map((code) => {
        const name = labelMap.get(code.toLowerCase()) || code
        return {
          code,
          title: t('discoveryStreaming.stripProvider', { name }),
          state: 'idle' as const,
          strip: null,
        }
      })
      setStripEntries(next)
      setLoadingLabels(false)
    })()

    return () => {
      cancelled = true
    }
  }, [country, language, missingOnly, providerStrips, t])

  useEffect(() => {
    if (!debouncedQ) {
      setSearchStrip(null)
      return
    }
    let cancelled = false
    void (async () => {
      setSearchLoading(true)
      const s = await fetchOneStrip({ title: t('discoveryStreaming.searchResults'), q: debouncedQ })
      if (cancelled) return
      setSearchStrip(s)
      setSearchLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedQ, fetchOneStrip, t])

  const handleRequest = useCallback(
    async (
      candidate: DiscoveryCandidate,
      seasons?: number[],
      seerrOptions?: SeerrRequestOptions
    ) => {
      const result = await submitRequest(
        candidate.tmdbId,
        candidate.mediaType,
        candidate.title,
        undefined,
        seasons,
        seerrOptions
      )
      if (result.success && candidate.tmdbId) {
        setSeerrLocal((prev) => ({
          ...prev,
          [candidate.tmdbId]: {
            exists: false,
            status: 'pending',
            requested: true,
            requestStatus: 'pending',
          },
        }))
      }
    },
    [submitRequest]
  )

  const mergeSeerr = (tmdbId: number | null, strip: StripState): SeerrMediaStatus | undefined => {
    if (tmdbId == null) return undefined
    const base = strip.seerrStatuses[tmdbId]
    const loc = seerrLocal[tmdbId]
    if (!base && !loc) return undefined
    const merged: SeerrMediaStatus = {
      exists: loc?.exists ?? base?.exists ?? false,
      status: (loc?.status ?? base?.status ?? 'unknown') as SeerrMediaStatus['status'],
      requested: loc?.requested ?? base?.requested ?? false,
      requestStatus: loc?.requestStatus ?? base?.requestStatus,
      requestId: loc?.requestId ?? base?.requestId,
    }
    return merged
  }

  const renderStrip = (strip: StripState | null) => {
    if (!strip) return null
    if (strip.error) {
      return (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {strip.error}
        </Alert>
      )
    }
    if (strip.rows.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('discoveryStreaming.emptyStrip')}
        </Typography>
      )
    }
    return (
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x mandatory',
        }}
      >
        {strip.rows.map((row, idx) => {
          const candidate = rowToCandidate(row, idx)
          const status = mergeSeerr(row.tmdbId, strip)
          return (
            <Box
              key={row.jwNodeId}
              sx={{
                flex: '0 0 auto',
                width: 160,
                scrollSnapAlign: 'start',
                position: 'relative',
              }}
            >
              {row.chartTrend ? <ChartTrendBadge trend={row.chartTrend} /> : null}
              <DiscoveryCard
                candidate={candidate}
                canRequest={requestEnabled && !row.inLibrary && (row.tmdbId ?? 0) > 0}
                onRequest={handleRequest}
                isRequesting={isRequesting(candidate.tmdbId)}
                cachedStatus={status}
                fetchTVDetails={fetchTVDetails}
                resolveGenreName={resolveGenrePassthrough}
                inLibrary={row.inLibrary}
                libraryId={row.localMovieId ?? row.localSeriesId ?? null}
                showRank={false}
              />
            </Box>
          )
        })}
      </Box>
    )
  }

  const anyStale = stripEntries.some((e) => e.strip?.stale)

  return (
    <Accordion defaultExpanded sx={{ mb: 3, borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LiveTvIcon color="primary" />
          <Typography variant="h6">{t('discoveryStreaming.sectionTitle')}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('discoveryStreaming.sectionBlurb')}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
          <TextField
            label={t('discoveryStreaming.country')}
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 4))}
            size="small"
            sx={{ width: 120 }}
          />
          <Typography variant="body2" color="text.secondary">
            {t('discoveryStreaming.languageHint', { lang: language })}
          </Typography>
          <FormControlLabel
            control={<Switch checked={missingOnly} onChange={(_, v) => setMissingOnly(v)} />}
            label={t('discoveryStreaming.missingOnly')}
          />
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder={t('discoveryStreaming.searchPlaceholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          sx={{ mb: 2 }}
        />

        {loadingLabels && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('discoveryStreaming.loadingLabels')}
            </Typography>
            {providerStrips.map((code) => (
              <Box key={code} sx={{ mt: 3 }}>
                <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} animation="wave" />
                <StripSkeletonRow />
              </Box>
            ))}
          </Box>
        )}

        {!loadingLabels && anyStale && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('discoveryStreaming.staleCache')}
          </Alert>
        )}

        {!loadingLabels && (
          <>
            {debouncedQ && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  {t('discoveryStreaming.searchResults')}
                </Typography>
                {searchLoading ? <SearchStripSkeleton /> : renderStrip(searchStrip)}
              </Box>
            )}

            {stripEntries.map((entry, i) => (
              <LazyProviderStripRow
                key={entry.code}
                entry={entry}
                topMargin={i === 0 && !debouncedQ ? 0 : 3}
                onVisible={enqueueLoad}
              >
                {entry.state === 'idle' || entry.state === 'loading' ? (
                  <StripSkeletonRow />
                ) : (
                  renderStrip(entry.strip)
                )}
              </LazyProviderStripRow>
            ))}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
