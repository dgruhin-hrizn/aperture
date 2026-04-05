import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Skeleton,
  Typography,
  Paper,
  TextField,
  Stack,
  AppBar,
  Toolbar,
  Link as MuiLink,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Slider,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import SortIcon from '@mui/icons-material/Sort'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import { StatusCard } from '@aperture/ui'
import { MoviePoster } from '@aperture/ui'
import type { SeerrStatus } from '../../components/MediaPosterCard'
import { RequestSeerrOptionsDialog } from '../../components/RequestSeerrOptionsDialog'
import {
  TmdbExternalDetailModal,
  type TmdbExternalDetailPayload,
} from '../../components/TmdbExternalDetailModal'
import type { SeerrRequestOptions } from '../../types/seerrRequest'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'
const BULK_CONFIRM_THRESHOLD = 5

type GapRequestItem = { tmdbId: number; mediaType: 'movie'; title: string }

interface GapRun {
  id: string
  status: string
  collectionsScanned: number
  totalParts: number
  ownedParts: number
  missingCount: number
  completedAt: string | null
  startedAt: string
}

interface CollectionSummary {
  collectionId: number
  collectionName: string
  collectionPosterPath: string | null
  totalReleased: number
  ownedCount: number
  seerrCount: number
  missingCount: number
}

type PartSeerrStatus = 'none' | 'requested' | 'processing' | 'available'

interface GapCollectionPart {
  tmdbId: number
  title: string
  releaseYear: number | null
  releaseDate: string | null
  posterPath: string | null
  inLibrary: boolean
  seerrStatus: PartSeerrStatus
}

interface GapCollectionPartsPayload {
  collectionId: number
  collectionName: string
  collectionPosterPath: string | null
  parts: GapCollectionPart[]
}

interface GapRow {
  id: string
  collectionId: number
  collectionName: string
  collectionPosterPath: string | null
  tmdbId: number
  title: string
  releaseYear: number | null
  releaseDate?: string | null
  posterPath: string | null
  inLibrary: boolean
  seerrStatus: PartSeerrStatus
  requestStatus: string | null
}

interface JobProgressState {
  overallProgress: number
  currentStep: string
  itemsProcessed: number
  itemsTotal: number
  currentItem?: string
}

function seerrChipLabel(status: PartSeerrStatus): string {
  switch (status) {
    case 'requested': return 'Requested'
    case 'processing': return 'Processing'
    case 'available': return 'Available'
    default: return 'Requested'
  }
}

export function GapAnalysisPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<GapRun | null>(null)
  const [activeRun, setActiveRun] = useState<GapRun | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgressState | null>(null)
  const [summaries, setSummaries] = useState<CollectionSummary[]>([])
  const [prereq, setPrereq] = useState<{ tmdbConfigured: boolean; moviesWithCollectionCount: number } | null>(null)
  const [rows, setRows] = useState<GapRow[]>([])
  const [seerrOk, setSeerrOk] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [locallyRequested, setLocallyRequested] = useState<Set<number>>(new Set())
  const [requestOptionsOpen, setRequestOptionsOpen] = useState(false)
  const [itemsPendingSeerrOptions, setItemsPendingSeerrOptions] = useState<GapRequestItem[] | null>(null)
  const [optionsDialogTitle, setOptionsDialogTitle] = useState('')
  const [pendingBulkAfterOptions, setPendingBulkAfterOptions] = useState<{
    items: GapRequestItem[]
    seerrOptions: SeerrRequestOptions
  } | null>(null)
  const [collectionPartsById, setCollectionPartsById] = useState<Record<number, GapCollectionPartsPayload | undefined>>({})
  const [sortBy, setSortBy] = useState<'most_missing' | 'most_complete' | 'name'>('most_missing')
  const [minMissing, setMinMissing] = useState(0)
  const [collapsedCollections, setCollapsedCollections] = useState<Set<number>>(new Set())
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<TmdbExternalDetailPayload | null>(null)
  const [detailPart, setDetailPart] = useState<GapCollectionPart | null>(null)

  const toSeerrStatus = useCallback(
    (row: GapRow): SeerrStatus | undefined => {
      const serverBlocking = ['pending', 'submitted', 'approved'].includes(row.requestStatus ?? '')
      const optimistic = locallyRequested.has(row.tmdbId)
      if (!serverBlocking && !optimistic) return undefined
      if (optimistic && !serverBlocking) {
        return { requested: true, requestStatus: 'pending' }
      }
      const rs = row.requestStatus
      let requestStatus: SeerrStatus['requestStatus'] = 'unknown'
      if (rs === 'pending') requestStatus = 'pending'
      else if (rs === 'approved' || rs === 'submitted') requestStatus = 'approved'
      else if (rs === 'declined') requestStatus = 'declined'
      return { requested: true, requestStatus }
    },
    [locallyRequested]
  )

  const isDimmed = useCallback(
    (row: GapRow): boolean => {
      return (
        row.inLibrary ||
        ['pending', 'submitted', 'approved'].includes(row.requestStatus ?? '') ||
        locallyRequested.has(row.tmdbId)
      )
    },
    [locallyRequested]
  )

  useEffect(() => {
    setLocallyRequested((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      for (const r of rows) {
        if (['pending', 'submitted', 'approved'].includes(r.requestStatus ?? '')) {
          next.delete(r.tmdbId)
        }
      }
      return next
    })
  }, [rows])

  const loadLatest = useCallback(async (): Promise<GapRun | null> => {
    setError(null)
    try {
      const [latestRes, seerrRes] = await Promise.all([
        fetch('/api/admin/gap-analysis/latest', { credentials: 'include' }),
        fetch('/api/seerr/config', { credentials: 'include' }),
      ])
      if (!latestRes.ok) {
        const d = await latestRes.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to load gap analysis')
      }
      const data = await latestRes.json()
      setPrereq(data.prerequisites)
      const nextRun = data.run as GapRun | null
      setRun(nextRun)
      setActiveRun((data.activeRun as GapRun | null) ?? null)
      setSummaries(data.collectionSummaries || [])

      if (seerrRes.ok) {
        const sc = await seerrRes.json()
        setSeerrOk(!!(sc.configured && sc.enabled && sc.hasApiKey))
      } else {
        setSeerrOk(false)
      }
      return nextRun
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const loadResults = useCallback(async (runId: string) => {
    try {
      const all: GapRow[] = []
      let page = 1
      let total = 0
      do {
        const u = new URL('/api/admin/gap-analysis/results', window.location.origin)
        u.searchParams.set('runId', runId)
        u.searchParams.set('page', String(page))
        u.searchParams.set('pageSize', '500')
        if (search.trim()) u.searchParams.set('search', search.trim())
        const res = await fetch(u.toString(), { credentials: 'include' })
        if (!res.ok) break
        const data = await res.json()
        total = data.total ?? 0
        const chunk = (data.rows || []) as GapRow[]
        all.push(...chunk)
        page++
      } while (all.length < total && page < 40)
      setRows(all)
    } catch {
      /* keep prior rows on fetch error */
    }
  }, [search])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  const displayRunId = activeRun?.id ?? run?.id

  useEffect(() => {
    if (displayRunId) {
      void loadResults(displayRunId)
    } else {
      setRows([])
    }
  }, [displayRunId, loadResults])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.collectionName.toLowerCase().includes(q)
    )
  }, [rows, search])

  const sortedMissingRows = filteredRows

  const grouped = useMemo(() => {
    const m = new Map<number, GapRow[]>()
    for (const r of sortedMissingRows) {
      const list = m.get(r.collectionId) || []
      list.push(r)
      m.set(r.collectionId, list)
    }
    return m
  }, [sortedMissingRows])

  const collectionOrder = useMemo(() => {
    const seen = new Set<number>()
    const order: number[] = []
    for (const r of sortedMissingRows) {
      if (!seen.has(r.collectionId)) {
        seen.add(r.collectionId)
        order.push(r.collectionId)
      }
    }
    return order
  }, [sortedMissingRows])

  const displaySummariesOrdered = useMemo(() => {
    const byId = new Map(summaries.map((s) => [s.collectionId, s]))
    const built = collectionOrder
      .map((cid) => {
        const gapRows = grouped.get(cid)
        if (!gapRows?.length) return null
        const server = byId.get(cid)
        const first = gapRows[0]
        const posterFromRows = first.collectionPosterPath ?? first.posterPath ?? null
        if (server) {
          return { ...server, collectionPosterPath: server.collectionPosterPath ?? posterFromRows }
        }
        return {
          collectionId: cid,
          collectionName: first.collectionName,
          collectionPosterPath: posterFromRows,
          totalReleased: gapRows.length,
          ownedCount: 0,
          seerrCount: 0,
          missingCount: gapRows.length,
        }
      })
      .filter((s): s is CollectionSummary => s != null)
      .filter((s) => s.missingCount >= minMissing)

    if (sortBy === 'most_missing') {
      built.sort((a, b) => b.missingCount - a.missingCount || a.collectionName.localeCompare(b.collectionName))
    } else if (sortBy === 'most_complete') {
      built.sort((a, b) => {
        const ratioA = a.totalReleased > 0 ? a.ownedCount / a.totalReleased : 0
        const ratioB = b.totalReleased > 0 ? b.ownedCount / b.totalReleased : 0
        return ratioB - ratioA || a.collectionName.localeCompare(b.collectionName)
      })
    } else {
      built.sort((a, b) => a.collectionName.localeCompare(b.collectionName))
    }

    return built
  }, [summaries, collectionOrder, grouped, sortBy, minMissing])

  const maxMissing = useMemo(() => {
    let max = 0
    for (const s of summaries) {
      if (s.missingCount > max) max = s.missingCount
    }
    return max
  }, [summaries])

  const collectionIdsForPartsKey = useMemo(
    () => displaySummariesOrdered.map((s) => s.collectionId).join(','),
    [displaySummariesOrdered]
  )

  useEffect(() => {
    if (!collectionIdsForPartsKey) {
      setCollectionPartsById({})
      return
    }
    const ids = collectionIdsForPartsKey
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n))
    if (ids.length === 0) {
      setCollectionPartsById({})
      return
    }
    let cancelled = false
    const u = new URL('/api/admin/gap-analysis/collection-parts', window.location.origin)
    u.searchParams.set('ids', ids.join(','))
    void fetch(u.toString(), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load collection parts'))))
      .then((d: { collections?: Record<string, GapCollectionPartsPayload> }) => {
        if (cancelled) return
        const next: Record<number, GapCollectionPartsPayload> = {}
        for (const id of ids) {
          const p = d.collections?.[String(id)]
          if (p) next[id] = p
        }
        setCollectionPartsById(next)
      })
      .catch(() => {
        if (!cancelled) setCollectionPartsById({})
      })
    return () => { cancelled = true }
  }, [collectionIdsForPartsKey])

  const toggleSelect = (key: string, dimmed: boolean) => {
    if (dimmed) return
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const selectAllVisible = () => {
    const n = new Set<string>()
    for (const r of filteredRows) {
      if (!isDimmed(r)) n.add(`${r.tmdbId}`)
    }
    setSelected(n)
  }

  const clearSel = () => setSelected(new Set())

  const toggleCollapse = (cid: number) => {
    setCollapsedCollections((prev) => {
      const n = new Set(prev)
      if (n.has(cid)) n.delete(cid)
      else n.add(cid)
      return n
    })
  }

  const openDetailModal = useCallback((part: GapCollectionPart) => {
    setDetailPart(part)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)
    void fetch(`/api/discover/tmdb/movie/${part.tmdbId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || 'Failed to load details')
        }
        return r.json() as Promise<TmdbExternalDetailPayload>
      })
      .then((payload) => setDetailData(payload))
      .catch((e: unknown) => setDetailError(e instanceof Error ? e.message : 'Failed to load details'))
      .finally(() => setDetailLoading(false))
  }, [])

  const closeDetailModal = useCallback(() => {
    setDetailOpen(false)
    setDetailError(null)
    setDetailData(null)
    setDetailPart(null)
  }, [])

  const openSeerrOptionsStep = useCallback(
    (items: GapRequestItem[], titleOverride?: string) => {
      if (!seerrOk || items.length === 0) return
      setOptionsDialogTitle(
        titleOverride ?? (items.length === 1 ? items[0].title : `${items.length} movies`)
      )
      setItemsPendingSeerrOptions(items)
      setRequestOptionsOpen(true)
    },
    [seerrOk]
  )

  const executeGapRequest = useCallback(
    async (items: GapRequestItem[], seerrOptions: SeerrRequestOptions) => {
      setRequesting(true)
      try {
        const res = await fetch('/api/admin/gap-analysis/request', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            ...(Object.keys(seerrOptions).length > 0 ? { seerrOptions } : {}),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || data.message || 'Request failed')
        const errs = (data.errors || []) as { tmdbId: number; title: string; message: string }[]
        if (errs.length > 0) {
          setError(
            errs
              .slice(0, 3)
              .map((e) => `${e.title || e.tmdbId}: ${e.message}`)
              .join(' · ')
          )
        } else {
          setError(null)
        }
        const errored = new Set(errs.map((e) => e.tmdbId))
        setLocallyRequested((prev) => {
          const next = new Set(prev)
          for (const it of items) {
            if (!errored.has(it.tmdbId)) next.add(it.tmdbId)
          }
          return next
        })
        const nextRun = await loadLatest()
        if (nextRun?.id) await loadResults(nextRun.id)
        clearSel()
        setConfirmOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed')
        setConfirmOpen(false)
      } finally {
        setRequesting(false)
        setPendingBulkAfterOptions(null)
      }
    },
    [loadLatest, loadResults]
  )

  const handleSeerrOptionsConfirm = (opts: SeerrRequestOptions) => {
    const items = itemsPendingSeerrOptions
    setRequestOptionsOpen(false)
    setItemsPendingSeerrOptions(null)
    if (!items?.length) return
    if (items.length > BULK_CONFIRM_THRESHOLD) {
      setPendingBulkAfterOptions({ items, seerrOptions: opts })
      setConfirmOpen(true)
    } else {
      void executeGapRequest(items, opts)
    }
  }

  const handleSeerrOptionsDialogClose = () => {
    if (!requesting) {
      setRequestOptionsOpen(false)
      setItemsPendingSeerrOptions(null)
    }
  }

  const runRefresh = async () => {
    setRefreshing(true)
    setError(null)
    setJobProgress(null)
    let poll: ReturnType<typeof setInterval> | null = null
    try {
      const res = await fetch('/api/admin/gap-analysis/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Refresh failed')
      const jobId = data.jobId as string
      poll = setInterval(async () => {
        let terminal = false
        try {
          const [jr, latestRes] = await Promise.all([
            fetch(`/api/jobs/progress/${jobId}`, { credentials: 'include' }),
            fetch('/api/admin/gap-analysis/latest', { credentials: 'include' }),
          ])
          if (jr.ok) {
            const j = await jr.json()
            setJobProgress({
              overallProgress: typeof j.overallProgress === 'number' ? j.overallProgress : 0,
              currentStep: j.currentStep ?? '',
              itemsProcessed: typeof j.itemsProcessed === 'number' ? j.itemsProcessed : 0,
              itemsTotal: typeof j.itemsTotal === 'number' ? j.itemsTotal : 0,
              currentItem: j.currentItem,
            })
            if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
              terminal = true
            }
          }
          if (latestRes.ok) {
            const d = await latestRes.json()
            setActiveRun((d.activeRun as GapRun | null) ?? null)
            setRun((d.run as GapRun | null) ?? null)
            setSummaries(d.collectionSummaries || [])
            const ar = d.activeRun as GapRun | null
            if (ar?.id) {
              await loadResults(ar.id)
            }
          }
          if (terminal) {
            if (poll) clearInterval(poll)
            setRefreshing(false)
            setJobProgress(null)
            setActiveRun(null)
            await loadLatest()
          }
        } catch {
          if (poll) clearInterval(poll)
          setRefreshing(false)
          setJobProgress(null)
        }
      }, 600)
      setTimeout(() => {
        if (poll) clearInterval(poll)
        setRefreshing(false)
        setJobProgress(null)
      }, 15 * 60 * 1000)
    } catch (e) {
      if (poll) clearInterval(poll)
      setError(e instanceof Error ? e.message : 'Refresh failed')
      setRefreshing(false)
      setJobProgress(null)
    }
  }

  const buildItemsFromSelection = () =>
    filteredRows
      .filter((r) => selected.has(`${r.tmdbId}`))
      .map((r) => ({ tmdbId: r.tmdbId, mediaType: 'movie' as const, title: r.title }))

  const onToolbarRequest = () => {
    const items = buildItemsFromSelection()
    if (items.length === 0) return
    openSeerrOptionsStep(
      items,
      items.length === 1 ? items[0].title : `${items.length} selected titles`
    )
  }

  const closeConfirm = () => {
    if (!requesting) {
      setConfirmOpen(false)
      setPendingBulkAfterOptions(null)
    }
  }

  const snapshotRun = activeRun ?? run
  const completionPct =
    snapshotRun && snapshotRun.totalParts > 0
      ? Math.round((snapshotRun.ownedParts / snapshotRun.totalParts) * 1000) / 10
      : 0

  const LoadingSkeleton = () => (
    <Grid container spacing={2}>
      {[...Array(12)].map((_, i) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
          <MoviePoster title="" loading responsive hideRating hideHeartRating hideWatchingToggle hideExploreButton />
        </Grid>
      ))}
    </Grid>
  )

  const bulkPreConfirmCount = pendingBulkAfterOptions?.items.length ?? 0

  /** Build unified chronological parts list for a collection. */
  const getChronologicalParts = (
    collectionId: number,
    missingRows: GapRow[]
  ): { part: GapCollectionPart; gapRow?: GapRow; variant: 'owned' | 'seerr' | 'missing' }[] => {
    const partDetail = collectionPartsById[collectionId]
    if (!partDetail) {
      return missingRows.map((r) => ({
        part: {
          tmdbId: r.tmdbId,
          title: r.title,
          releaseYear: r.releaseYear,
          releaseDate: r.releaseDate ?? null,
          posterPath: r.posterPath,
          inLibrary: false,
          seerrStatus: 'none' as PartSeerrStatus,
        },
        gapRow: r,
        variant: 'missing' as const,
      }))
    }

    const missingByTmdb = new Map(missingRows.map((r) => [r.tmdbId, r]))

    return partDetail.parts
      .slice()
      .sort((a, b) => {
        const da = (a.releaseDate ?? '').slice(0, 10)
        const db = (b.releaseDate ?? '').slice(0, 10)
        if (da !== db) return da.localeCompare(db)
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      })
      .map((p) => {
        if (p.inLibrary) return { part: p, variant: 'owned' as const }
        if (p.seerrStatus !== 'none') return { part: p, variant: 'seerr' as const }
        const gapRow = missingByTmdb.get(p.tmdbId)
        return { part: p, gapRow, variant: 'missing' as const }
      })
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 }, pb: 10 }}>
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <FactCheckIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>
          Gap Analysis
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Compare TMDB movie collections against your synced library to find missing titles. Requests via Seerr are
        never automatic — you choose what to request.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <StatusCard
                title="TMDb"
                status={prereq?.tmdbConfigured ? 'ok' : 'error'}
                message={prereq?.tmdbConfigured ? 'API key configured' : 'Add your TMDb API key in Admin → Settings'}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatusCard
                title="Collections on movies"
                status={(prereq?.moviesWithCollectionCount ?? 0) > 0 ? 'ok' : 'error'}
                message={
                  (prereq?.moviesWithCollectionCount ?? 0) > 0
                    ? `${prereq?.moviesWithCollectionCount} movies have collection metadata`
                    : 'Run Enrich Metadata (Admin → Jobs) so movies get collection_id from TMDb'
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatusCard
                title="Seerr"
                status={seerrOk ? 'ok' : 'error'}
                message={seerrOk ? 'Ready for requests' : 'Configure Seerr in Admin → Settings to request missing titles'}
              />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={600}>Analysis snapshot</Typography>
                {activeRun ? (
                  <Typography variant="body2" color="text.secondary">
                    In progress — {activeRun.collectionsScanned} collections scanned, {activeRun.missingCount} missing
                    released titles so far, ~{completionPct}% released parts in library.
                  </Typography>
                ) : run ? (
                  <Typography variant="body2" color="text.secondary">
                    Last run: {new Date(run.completedAt || run.startedAt).toLocaleString()} — {run.collectionsScanned}{' '}
                    collections, {run.missingCount} missing released titles, ~{completionPct}% released parts in library.
                    Re-run after syncing new movies.
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No run yet. Start an analysis to scan your library against TMDb collections.
                  </Typography>
                )}
              </Box>
              <Button variant="contained" onClick={() => void runRefresh()} disabled={refreshing || !prereq?.tmdbConfigured}>
                {refreshing ? <CircularProgress size={22} color="inherit" /> : 'Run analysis'}
              </Button>
            </Stack>
          </Paper>

          {refreshing && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
              <Typography fontWeight={600} gutterBottom>
                {jobProgress?.currentStep || 'Starting gap analysis…'}
              </Typography>
              <LinearProgress
                variant={jobProgress && jobProgress.overallProgress > 0 ? 'determinate' : 'indeterminate'}
                value={jobProgress ? Math.min(100, jobProgress.overallProgress) : 0}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {jobProgress && jobProgress.itemsTotal > 0
                  ? `${jobProgress.itemsProcessed} / ${jobProgress.itemsTotal} collections`
                  : jobProgress?.currentItem || 'Scanning collections — results appear below as each batch finishes.'}
              </Typography>
              {activeRun != null && (
                <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                  {activeRun.missingCount} missing released title{activeRun.missingCount === 1 ? '' : 's'} so far — the
                  grid updates as analysis runs.
                </Typography>
              )}
            </Paper>
          )}

          {!prereq?.tmdbConfigured && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              TMDb is required. Open{' '}
              <MuiLink href="/admin/settings">Admin → Settings</MuiLink> to add your API key.
            </Alert>
          )}

          {displayRunId && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }} flexWrap="wrap">
                <TextField
                  size="small"
                  label="Search title or collection"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="gap-sort-by">Sort by</InputLabel>
                  <Select
                    labelId="gap-sort-by"
                    label="Sort by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'most_missing' | 'most_complete' | 'name')}
                    renderValue={(sel) => {
                      const labels: Record<string, string> = { most_missing: 'Most missing', most_complete: 'Most complete', name: 'Name A–Z' }
                      return (
                        <Stack direction="row" alignItems="center" gap={0.75} component="span">
                          <SortIcon fontSize="small" sx={{ opacity: 0.8 }} />
                          <Typography component="span" variant="body2">{labels[sel] ?? sel}</Typography>
                        </Stack>
                      )
                    }}
                  >
                    <MenuItem value="most_missing">Most missing</MenuItem>
                    <MenuItem value="most_complete">Most complete</MenuItem>
                    <MenuItem value="name">Name A–Z</MenuItem>
                  </Select>
                </FormControl>
                {maxMissing > 1 && (
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 200, maxWidth: 320, flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Min missing
                    </Typography>
                    <Slider
                      size="small"
                      value={minMissing}
                      min={0}
                      max={maxMissing}
                      onChange={(_, v) => setMinMissing(v as number)}
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 24, textAlign: 'right' }}>
                      {minMissing}
                    </Typography>
                  </Stack>
                )}
                <Button size="small" onClick={selectAllVisible}>Select all visible</Button>
                <Button size="small" onClick={clearSel}>Clear selection</Button>
              </Stack>

              <RequestSeerrOptionsDialog
                open={requestOptionsOpen}
                mediaType="movie"
                title={optionsDialogTitle || 'Request options'}
                onClose={handleSeerrOptionsDialogClose}
                onConfirm={handleSeerrOptionsConfirm}
              />

              {displaySummariesOrdered.length === 0 && filteredRows.length === 0 ? (
                <Alert severity="info">No missing titles in this snapshot (or nothing matches the filter).</Alert>
              ) : (
                <Stack spacing={3}>
                  {displaySummariesOrdered.map((s) => {
                    const missingRows = grouped.get(s.collectionId) || []
                    if (missingRows.length === 0) return null

                    const coveredCount = s.ownedCount + s.seerrCount
                    const ratio = s.totalReleased > 0 ? coveredCount / s.totalReleased : 0
                    const collapsed = collapsedCollections.has(s.collectionId)
                    const allParts = getChronologicalParts(s.collectionId, missingRows)

                    return (
                      <Paper key={s.collectionId} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        {/* Collection header */}
                        <Box
                          onClick={() => toggleCollapse(s.collectionId)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background-color 0.15s',
                          }}
                        >
                          <Box sx={{ flexShrink: 0, width: { xs: 60, sm: 80 } }}>
                            <MoviePoster
                              title={s.collectionName}
                              posterUrl={s.collectionPosterPath ? `${TMDB_IMG}${s.collectionPosterPath}` : null}
                              responsive
                              hideYear
                              hideHeartRating
                              hideWatchingToggle
                              hideExploreButton
                              hideRating
                            />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" fontWeight={700} noWrap>{s.collectionName}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
                              {s.ownedCount > 0 && (
                                <Chip
                                  icon={<CheckCircleIcon />}
                                  label={`${s.ownedCount} owned`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              {s.seerrCount > 0 && (
                                <Chip
                                  icon={<HourglassEmptyIcon />}
                                  label={`${s.seerrCount} in Seerr`}
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {coveredCount}/{s.totalReleased} covered — {missingRows.length} missing
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, ratio * 100)}
                              sx={{ mt: 1, maxWidth: 300, borderRadius: 1 }}
                            />
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                const n = new Set(selected)
                                for (const r of missingRows) {
                                  if (!isDimmed(r)) n.add(`${r.tmdbId}`)
                                }
                                setSelected(n)
                              }}
                            >
                              Select all
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!seerrOk || missingRows.filter((r) => !isDimmed(r)).length === 0}
                              onClick={(e) => {
                                e.stopPropagation()
                                const requestable = missingRows
                                  .filter((r) => !isDimmed(r))
                                  .map((r) => ({ tmdbId: r.tmdbId, mediaType: 'movie' as const, title: r.title }))
                                openSeerrOptionsStep(requestable, `${s.collectionName} — request all missing`)
                              }}
                            >
                              Request all
                            </Button>
                            <IconButton size="small">
                              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                            </IconButton>
                          </Stack>
                        </Box>

                        {/* Poster grid */}
                        {!collapsed && (
                          <Box sx={{ px: 2, pb: 2 }}>
                            <Grid container spacing={2}>
                              {allParts.map(({ part: p, gapRow, variant }) => {
                                const isOwned = variant === 'owned'
                                const isSeerr = variant === 'seerr'
                                const isMissing = variant === 'missing'
                                const dim = isMissing && gapRow ? isDimmed(gapRow) : false
                                const isChecked = isMissing && selected.has(`${p.tmdbId}`)
                                const seerr = isMissing && gapRow ? toSeerrStatus(gapRow) : undefined
                                const apertureRequested = !!(seerr?.requested)
                                const posterOpacity = isOwned ? 0.45 : isSeerr ? 0.55 : dim ? 0.55 : 1

                                return (
                                  <Grid item xs={6} sm={4} md={3} lg={2} key={`${variant}-${p.tmdbId}`}>
                                    <Box sx={{ position: 'relative' }}>
                                      <Box sx={{ opacity: posterOpacity, transition: 'opacity 0.2s' }}>
                                        <MoviePoster
                                          title={p.title}
                                          year={p.releaseYear}
                                          posterUrl={p.posterPath ? `${TMDB_IMG}${p.posterPath}` : null}
                                          responsive
                                          hideRating
                                          hideHeartRating
                                          hideWatchingToggle
                                          hideExploreButton
                                          onClick={() => openDetailModal(p)}
                                        >
                                          {/* Status badge overlay */}
                                          {isOwned && (
                                            <Chip
                                              icon={<CheckCircleIcon />}
                                              label="In Library"
                                              size="small"
                                              sx={{
                                                position: 'absolute',
                                                bottom: 8,
                                                left: 8,
                                                zIndex: 3,
                                                fontWeight: 600,
                                                fontSize: '0.7rem',
                                                height: 24,
                                                bgcolor: 'rgba(34, 197, 94, 0.9)',
                                                color: 'white',
                                                '& .MuiChip-icon': { color: 'white' },
                                              }}
                                            />
                                          )}
                                          {isSeerr && (
                                            <Chip
                                              icon={<HourglassEmptyIcon />}
                                              label={seerrChipLabel(p.seerrStatus)}
                                              size="small"
                                              sx={{
                                                position: 'absolute',
                                                bottom: 8,
                                                left: 8,
                                                zIndex: 3,
                                                fontWeight: 600,
                                                fontSize: '0.7rem',
                                                height: 24,
                                                bgcolor: 'rgba(59, 130, 246, 0.9)',
                                                color: 'white',
                                                '& .MuiChip-icon': { color: 'white' },
                                              }}
                                            />
                                          )}
                                          {isMissing && apertureRequested && (
                                            <Chip
                                              icon={<HourglassEmptyIcon />}
                                              label={seerr?.requestStatus === 'pending' ? 'Pending' : 'Requested'}
                                              size="small"
                                              sx={{
                                                position: 'absolute',
                                                bottom: 8,
                                                left: 8,
                                                zIndex: 3,
                                                fontWeight: 600,
                                                fontSize: '0.7rem',
                                                height: 24,
                                                bgcolor: 'rgba(139, 92, 246, 0.9)',
                                                color: 'white',
                                                '& .MuiChip-icon': { color: 'white' },
                                              }}
                                            />
                                          )}
                                          {isMissing && !apertureRequested && (
                                            <Checkbox
                                              size="small"
                                              checked={isChecked}
                                              disabled={dim}
                                              onChange={(e) => { e.stopPropagation(); toggleSelect(`${p.tmdbId}`, dim) }}
                                              inputProps={{ 'aria-label': `Select ${p.title}` }}
                                              sx={{
                                                position: 'absolute',
                                                top: 4,
                                                left: 4,
                                                zIndex: 5,
                                                bgcolor: 'rgba(0,0,0,0.5)',
                                                borderRadius: 1,
                                                p: 0.25,
                                                color: 'white',
                                                '&.Mui-checked': { color: 'primary.main' },
                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                                              }}
                                            />
                                          )}
                                          {isMissing && !apertureRequested && !dim && seerrOk && (
                                            <Button
                                              size="small"
                                              variant="contained"
                                              sx={{
                                                position: 'absolute',
                                                bottom: 8,
                                                right: 8,
                                                zIndex: 5,
                                                minWidth: 0,
                                                py: 0.25,
                                                px: 1,
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                textTransform: 'none',
                                                bgcolor: 'rgba(99, 102, 241, 0.9)',
                                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 1)' },
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openSeerrOptionsStep([{ tmdbId: p.tmdbId, mediaType: 'movie', title: p.title }])
                                              }}
                                            >
                                              Request
                                            </Button>
                                          )}
                                        </MoviePoster>
                                      </Box>
                                    </Box>
                                  </Grid>
                                )
                              })}
                            </Grid>
                          </Box>
                        )}
                      </Paper>
                    )
                  })}
                </Stack>
              )}
            </>
          )}
        </>
      )}

      <TmdbExternalDetailModal
        open={detailOpen}
        onClose={closeDetailModal}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        sourceLabel="Gap Analysis"
        canRequest={
          seerrOk &&
          !!detailPart &&
          !detailPart.inLibrary &&
          detailPart.seerrStatus === 'none' &&
          !locallyRequested.has(detailPart.tmdbId)
        }
        seerrAvailable={detailPart?.inLibrary || detailPart?.seerrStatus === 'available'}
        seerrPending={
          detailPart?.seerrStatus === 'requested' ||
          detailPart?.seerrStatus === 'processing' ||
          (!!detailPart && locallyRequested.has(detailPart.tmdbId))
        }
        onRequest={
          detailPart
            ? () => {
                closeDetailModal()
                openSeerrOptionsStep([{ tmdbId: detailPart.tmdbId, mediaType: 'movie', title: detailPart.title }])
              }
            : undefined
        }
      />

      {selected.size > 0 && (
        <AppBar
          position="fixed"
          color="default"
          sx={{ top: 'auto', bottom: 0, borderTop: 1, borderColor: 'divider' }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2">{selected.size} selected</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={clearSel}>Clear</Button>
              <Button variant="contained" disabled={!seerrOk} onClick={onToolbarRequest}>
                Request selected via Seerr
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      <Dialog open={confirmOpen} onClose={closeConfirm} maxWidth="sm" fullWidth>
        <DialogTitle>Request via Seerr?</DialogTitle>
        <DialogContent>
          {pendingBulkAfterOptions ? (
            <>
              <Typography variant="body2" color="text.secondary" mb={2}>
                This will send {bulkPreConfirmCount} request(s) to Seerr using your linked account (Radarr options
                already chosen). You can track them under My Requests.
              </Typography>
              {requesting && <CircularProgress size={24} />}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} disabled={requesting}>Cancel</Button>
          {pendingBulkAfterOptions && (
            <Button
              variant="contained"
              disabled={requesting || !seerrOk || bulkPreConfirmCount === 0}
              onClick={() => {
                const b = pendingBulkAfterOptions
                if (!b) return
                void executeGapRequest(b.items, b.seerrOptions)
              }}
            >
              Confirm
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
