import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Skeleton, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CategoryIcon from '@mui/icons-material/Category'
import { DiscoveryCard } from './DiscoveryCard'
import { useSeerrRequest } from '../hooks/useSeerrRequest'
import type { DiscoveryCandidate, MediaType, SeerrMediaStatus } from '../types'
import type { SeerrRequestOptions } from '../../../types/seerrRequest'
import type { ResolveDiscoveryGenreName } from '../hooks/useDiscoveryGenres'

interface StripState {
  candidates: DiscoveryCandidate[]
  seerrStatuses: Record<number, SeerrMediaStatus>
  error: string | null
}

interface StripEntry {
  genreIds: number[]
  limit: number
  /** Overrides joined genre names as the row heading when non-empty. */
  label?: string
  /** ISO 3166-1 alpha-2; TMDb Discover `with_origin_country`. */
  originCountry?: string
  excludeGenreIds?: number[]
  yearStart?: number
  yearEnd?: number
  /** Rolling end year (current calendar year at fetch time). */
  yearEndCurrent?: boolean
  state: 'idle' | 'loading' | 'loaded'
  strip: StripState | null
}

const STRIP_QUEUE_YEAR_MIN = 1900
const STRIP_QUEUE_YEAR_MAX = 2100

function rowQueueKey(
  genreIds: number[],
  limit: number,
  originCountry?: string,
  excludeGenreIds?: number[],
  yearStart?: number,
  yearEnd?: number,
  yearEndCurrent?: boolean
): string {
  const c = (originCountry ?? '').trim().toUpperCase()
  const cc = c && /^[A-Z]{2}$/.test(c) ? c : ''
  const ex = (excludeGenreIds ?? []).join('|')
  const ys = yearStart !== undefined ? String(yearStart) : ''
  const ye =
    yearEndCurrent === true ? 'c' : yearEnd !== undefined ? String(yearEnd) : ''
  return `${genreIds.join('|')}::${limit}::${cc}::${ex}::${ys}::${ye}`
}

function stripRowKey(e: StripEntry): string {
  return rowQueueKey(
    e.genreIds,
    e.limit,
    e.originCountry,
    e.excludeGenreIds,
    e.yearStart,
    e.yearEnd,
    e.yearEndCurrent
  )
}

function parseQueueKey(key: string): {
  genreIds: number[]
  limit: number
  originCountry?: string
  excludeGenreIds?: number[]
  yearStart?: number
  yearEnd?: number
  yearEndCurrent?: boolean
} | null {
  const parts = key.split('::')
  if (parts.length < 2) return null
  const genreIds = parts[0]
    .split('|')
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
  if (genreIds.some((n) => !Number.isFinite(n) || n < 1)) return null
  const limit = parseInt(parts[1], 10)
  if (!Number.isFinite(limit) || limit < 1) return null
  const c = parts[2]?.trim()
  const originCountry = c && /^[A-Z]{2}$/i.test(c) ? c.toUpperCase() : undefined
  if (parts.length < 6) {
    if (parts.length > 3) return null
    return { genreIds, limit, originCountry }
  }
  const excludePart = parts[3] ?? ''
  const excludeGenreIds =
    excludePart === ''
      ? []
      : excludePart
          .split('|')
          .filter(Boolean)
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n >= 1)
  if (excludePart !== '' && excludeGenreIds.length === 0) return null
  const ysRaw = parts[4] ?? ''
  const yeRaw = parts[5] ?? ''
  let yearStart: number | undefined
  let yearEnd: number | undefined
  let yearEndCurrent: boolean | undefined
  if (ysRaw !== '') {
    const y = parseInt(ysRaw, 10)
    if (!Number.isFinite(y) || y < STRIP_QUEUE_YEAR_MIN || y > STRIP_QUEUE_YEAR_MAX) return null
    yearStart = y
  }
  if (yeRaw !== '') {
    if (yeRaw === 'c') {
      yearEndCurrent = true
    } else {
      const y = parseInt(yeRaw, 10)
      if (!Number.isFinite(y) || y < STRIP_QUEUE_YEAR_MIN || y > STRIP_QUEUE_YEAR_MAX) return null
      yearEnd = y
    }
  }
  return { genreIds, limit, originCountry, excludeGenreIds, yearStart, yearEnd, yearEndCurrent }
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

function StripSkeletonRow({ count }: { count: number }) {
  const n = Math.min(Math.max(count, 4), 16)
  return (
    <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden', pb: 1 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={160} height={240} sx={{ flexShrink: 0, borderRadius: 2 }} animation="wave" />
      ))}
    </Box>
  )
}

function LazyGenreStripRow({
  entry,
  topMargin,
  onVisible,
  resolveGenreName,
  children,
}: {
  entry: StripEntry
  topMargin: number
  onVisible: (rowKey: string) => void
  resolveGenreName: ResolveDiscoveryGenreName
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rk = stripRowKey(entry)

  useEffect(() => {
    if (entry.state !== 'idle') return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) {
          onVisible(rk)
        }
      },
      { root: null, rootMargin: '180px 0px 200px 0px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [rk, entry.state, onVisible])

  const customTitle = entry.label?.trim()
  const title =
    customTitle && customTitle.length > 0
      ? customTitle
      : entry.genreIds.length === 0
        ? ''
        : entry.genreIds.map((id) => resolveGenreName(id, `#${id}`)).join(' · ')

  return (
    <Box ref={ref} sx={{ mt: topMargin }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

export function TmdbGenreRowsSection({
  mediaType,
  requestEnabled,
  resolveGenreName,
}: {
  mediaType: MediaType
  requestEnabled: boolean
  resolveGenreName: ResolveDiscoveryGenreName
}) {
  const { t } = useTranslation()
  const [stripEntries, setStripEntries] = useState<StripEntry[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [seerrLocal, setSeerrLocal] = useState<Record<number, Partial<SeerrMediaStatus>>>({})

  const stripEntriesRef = useRef(stripEntries)
  stripEntriesRef.current = stripEntries

  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const queuedRef = useRef<Set<string>>(new Set())

  const { submitRequest, isRequesting, fetchTVDetails } = useSeerrRequest()

  useEffect(() => {
    let cancelled = false
    queueRef.current = []
    queuedRef.current = new Set()
    processingRef.current = false
    setStripEntries([])
    setLoadingConfig(true)

    void (async () => {
      try {
        const res = await fetch('/api/discovery/tmdb-genre-rows/config', { credentials: 'include' })
        if (!res.ok) {
          setStripEntries([])
          setLoadingConfig(false)
          return
        }
        const data = (await res.json()) as {
          movieGenreRows?: Array<
            | {
                genreIds: number[]
                limit: number
                label?: string
                originCountry?: string
                excludeGenreIds?: number[]
                yearStart?: number
                yearEnd?: number
                yearEndCurrent?: boolean
              }
            | number[]
          >
          seriesGenreRows?: Array<
            | {
                genreIds: number[]
                limit: number
                label?: string
                originCountry?: string
                excludeGenreIds?: number[]
                yearStart?: number
                yearEnd?: number
                yearEndCurrent?: boolean
              }
            | number[]
          >
        }
        const rawRows =
          mediaType === 'movie'
            ? Array.isArray(data.movieGenreRows) && data.movieGenreRows.length > 0
              ? data.movieGenreRows
              : []
            : Array.isArray(data.seriesGenreRows) && data.seriesGenreRows.length > 0
              ? data.seriesGenreRows
              : []
        if (cancelled) return
        const next: StripEntry[] = rawRows.map((row) => {
          if (Array.isArray(row)) {
          return {
            genreIds: row,
            limit: 24,
            state: 'idle' as const,
            strip: null,
          }
        }
          const lim = typeof row.limit === 'number' && row.limit >= 1 ? Math.min(48, Math.floor(row.limit)) : 24
          const label =
            typeof row.label === 'string' && row.label.trim() !== '' ? row.label.trim().slice(0, 80) : undefined
          const ocRaw = typeof row.originCountry === 'string' ? row.originCountry.trim().toUpperCase() : ''
          const originCountry = ocRaw && /^[A-Z]{2}$/.test(ocRaw) ? ocRaw : undefined
          const excludeGenreIds = Array.isArray(row.excludeGenreIds)
            ? row.excludeGenreIds.filter((id) => typeof id === 'number' && id >= 1)
            : undefined
          const yearEndCurrent = row.yearEndCurrent === true
          const yearStart = typeof row.yearStart === 'number' ? row.yearStart : undefined
          const yearEnd =
            yearEndCurrent ? undefined : typeof row.yearEnd === 'number' ? row.yearEnd : undefined
          return {
            genreIds: Array.isArray(row.genreIds) ? row.genreIds : [],
            limit: lim,
            label,
            originCountry,
            excludeGenreIds,
            yearStart,
            yearEnd,
            yearEndCurrent: yearEndCurrent ? true : undefined,
            state: 'idle' as const,
            strip: null,
          }
        })
        setStripEntries(next)
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mediaType])

  const fetchOneStrip = useCallback(
    async (params: {
      genreIds: number[]
      limit: number
      originCountry?: string
      excludeGenreIds?: number[]
      yearStart?: number
      yearEnd?: number
      yearEndCurrent?: boolean
    }): Promise<StripState> => {
      const { genreIds, limit, originCountry, excludeGenreIds, yearStart, yearEnd, yearEndCurrent } =
        params
      const qs = buildQuery({
        mediaType,
        genreIds: genreIds.join(','),
        limit: String(limit),
        withOriginCountry: originCountry,
        excludeGenreIds: excludeGenreIds?.length ? excludeGenreIds.join(',') : undefined,
        yearStart: yearStart !== undefined ? String(yearStart) : undefined,
        yearEnd:
          yearEndCurrent === true
            ? 'today'
            : yearEnd !== undefined
              ? String(yearEnd)
              : undefined,
      })
      const res = await fetch(`/api/discovery/tmdb-genre-row${qs}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return {
          candidates: [],
          seerrStatuses: {},
          error: typeof err.error === 'string' ? err.error : t('discoveryGenreRows.loadError'),
        }
      }
      const data = (await res.json()) as {
        candidates: DiscoveryCandidate[]
        seerrStatuses?: Record<number, SeerrMediaStatus>
      }
      return {
        candidates: data.candidates || [],
        seerrStatuses: (data.seerrStatuses || {}) as Record<number, SeerrMediaStatus>,
        error: null,
      }
    },
    [mediaType, t]
  )

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    const key = queueRef.current.shift()
    if (!key) return
    processingRef.current = true
    queuedRef.current.delete(key)

    const parsed = parseQueueKey(key)
    if (!parsed) {
      processingRef.current = false
      void processQueue()
      return
    }
    const { genreIds, limit, originCountry, excludeGenreIds, yearStart, yearEnd, yearEndCurrent } =
      parsed

    setStripEntries((prev) =>
      prev.map((e) => (stripRowKey(e) === key ? { ...e, state: 'loading' } : e))
    )

    try {
      const strip = await fetchOneStrip({
        genreIds,
        limit,
        originCountry,
        excludeGenreIds,
        yearStart,
        yearEnd,
        yearEndCurrent,
      })
      setStripEntries((prev) =>
        prev.map((e) => (stripRowKey(e) === key ? { ...e, state: 'loaded', strip } : e))
      )
    } catch {
      setStripEntries((prev) =>
        prev.map((e) =>
          stripRowKey(e) === key
            ? {
                ...e,
                state: 'loaded',
                strip: {
                  candidates: [],
                  seerrStatuses: {},
                  error: t('discoveryGenreRows.loadError'),
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
    (key: string) => {
      const cur = stripEntriesRef.current.find((e) => stripRowKey(e) === key)
      if (!cur || cur.state !== 'idle') return
      if (queuedRef.current.has(key)) return
      queuedRef.current.add(key)
      queueRef.current.push(key)
      void processQueue()
    },
    [processQueue]
  )

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

  const mergeSeerr = (tmdbId: number, strip: StripState): SeerrMediaStatus | undefined => {
    const base = strip.seerrStatuses[tmdbId]
    const loc = seerrLocal[tmdbId]
    if (!base && !loc) return undefined
    return {
      exists: loc?.exists ?? base?.exists ?? false,
      status: (loc?.status ?? base?.status ?? 'unknown') as SeerrMediaStatus['status'],
      requested: loc?.requested ?? base?.requested ?? false,
      requestStatus: loc?.requestStatus ?? base?.requestStatus,
      requestId: loc?.requestId ?? base?.requestId,
    }
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
    if (strip.candidates.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('discoveryGenreRows.emptyStrip')}
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
        {strip.candidates.map((candidate) => {
          const status = mergeSeerr(candidate.tmdbId, strip)
          return (
            <Box
              key={candidate.id}
              sx={{
                flex: '0 0 auto',
                width: 160,
                scrollSnapAlign: 'start',
              }}
            >
              <DiscoveryCard
                candidate={candidate}
                canRequest={requestEnabled}
                onRequest={handleRequest}
                isRequesting={isRequesting(candidate.tmdbId)}
                cachedStatus={status}
                fetchTVDetails={fetchTVDetails}
                resolveGenreName={resolveGenreName}
                showRank={false}
              />
            </Box>
          )
        })}
      </Box>
    )
  }

  if (loadingConfig) {
    return (
      <Accordion defaultExpanded sx={{ mb: 3, borderRadius: 2, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <CategoryIcon color="primary" />
            <Typography variant="h6">{t('discoveryGenreRows.sectionTitle')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
          <StripSkeletonRow count={8} />
        </AccordionDetails>
      </Accordion>
    )
  }

  if (stripEntries.length === 0) {
    return null
  }

  return (
    <Accordion defaultExpanded sx={{ mb: 3, borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1}>
          <CategoryIcon color="primary" />
          <Typography variant="h6">{t('discoveryGenreRows.sectionTitle')}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('discoveryGenreRows.sectionBlurb')}
        </Typography>

        {stripEntries.map((entry, i) => (
          <LazyGenreStripRow
            key={`${i}-${stripRowKey(entry)}`}
            entry={entry}
            topMargin={i === 0 ? 0 : 3}
            onVisible={enqueueLoad}
            resolveGenreName={resolveGenreName}
          >
            {entry.state === 'idle' || entry.state === 'loading' ? (
              <StripSkeletonRow count={entry.limit} />
            ) : (
              renderStrip(entry.strip)
            )}
          </LazyGenreStripRow>
        ))}
      </AccordionDetails>
    </Accordion>
  )
}
