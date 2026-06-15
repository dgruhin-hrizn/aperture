import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HybridExternalSource, LibraryMatchResult, PopularitySource, PreviewCountConfig, PreviewCounts, TopPicksConfig, TopPicksMediaType } from '../types'

export function useTopPicksLibraryPreview(config: TopPicksConfig | null) {
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [, setMoviesListCounts] = useState<{ total: number } | null>(null)
  const [, setSeriesListCounts] = useState<{ total: number } | null>(null)
  const [moviesLibraryMatch, setMoviesLibraryMatch] = useState<LibraryMatchResult | null>(null)
  const [seriesLibraryMatch, setSeriesLibraryMatch] = useState<LibraryMatchResult | null>(null)
  const [moviesMatchLoading, setMoviesMatchLoading] = useState(false)
  const [seriesMatchLoading, setSeriesMatchLoading] = useState(false)
  const [moviesMatchExpanded, setMoviesMatchExpanded] = useState(false)
  const [seriesMatchExpanded, setSeriesMatchExpanded] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewModalMediaType, setPreviewModalMediaType] = useState<TopPicksMediaType>('movies')
  const moviesPopularitySource = config?.moviesPopularitySource
  const moviesMinUniqueViewers = config?.moviesMinUniqueViewers
  const moviesTimeWindowDays = config?.moviesTimeWindowDays
  const moviesHybridExternalSource = config?.moviesHybridExternalSource
  const mdblistMoviesListId = config?.mdblistMoviesListId
  const mdblistMoviesSort = config?.mdblistMoviesSort
  const moviesLanguages = config?.moviesLanguages
  const moviesIncludeUnknownLanguage = config?.moviesIncludeUnknownLanguage
  const seriesPopularitySource = config?.seriesPopularitySource
  const seriesMinUniqueViewers = config?.seriesMinUniqueViewers
  const seriesTimeWindowDays = config?.seriesTimeWindowDays
  const seriesHybridExternalSource = config?.seriesHybridExternalSource
  const mdblistSeriesListId = config?.mdblistSeriesListId
  const mdblistSeriesSort = config?.mdblistSeriesSort
  const seriesLanguages = config?.seriesLanguages
  const seriesIncludeUnknownLanguage = config?.seriesIncludeUnknownLanguage

  const previewConfig = useMemo<PreviewCountConfig | null>(() => {
    if (
      !moviesPopularitySource ||
      moviesMinUniqueViewers === undefined ||
      moviesTimeWindowDays === undefined ||
      !seriesPopularitySource ||
      seriesMinUniqueViewers === undefined ||
      seriesTimeWindowDays === undefined
    ) {
      return null
    }

    return {
      moviesPopularitySource,
      moviesMinUniqueViewers,
      moviesTimeWindowDays,
      seriesPopularitySource,
      seriesMinUniqueViewers,
      seriesTimeWindowDays,
    }
  }, [
    moviesPopularitySource,
    moviesMinUniqueViewers,
    moviesTimeWindowDays,
    seriesPopularitySource,
    seriesMinUniqueViewers,
    seriesTimeWindowDays,
  ])

  const fetchListCounts = useCallback(async (listId: number | null, type: TopPicksMediaType) => {
    if (!listId) { if (type === 'movies') setMoviesListCounts(null); else setSeriesListCounts(null); return }
    try {
      const response = await fetch(`/api/mdblist/lists/${listId}/counts`, { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as { total: number }
        if (type === 'movies') setMoviesListCounts(data); else setSeriesListCounts(data)
      }
    } catch { /* silent */ }
  }, [])

  const fetchLibraryMatch = useCallback(async (listId: number | null, type: TopPicksMediaType, sort: string) => {
    if (!listId) { if (type === 'movies') setMoviesLibraryMatch(null); else setSeriesLibraryMatch(null); return }
    if (type === 'movies') setMoviesMatchLoading(true); else setSeriesMatchLoading(true)
    try {
      const mediatype = type === 'movies' ? 'movie' : 'show'
      const response = await fetch(`/api/mdblist/lists/${listId}/library-match?mediatype=${mediatype}&sort=${sort}`, { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as LibraryMatchResult
        if (type === 'movies') setMoviesLibraryMatch(data); else setSeriesLibraryMatch(data)
      }
    } catch { /* silent */ } finally { if (type === 'movies') setMoviesMatchLoading(false); else setSeriesMatchLoading(false) }
  }, [])

  const fetchSourcePreview = useCallback(async (
    type: TopPicksMediaType,
    source: PopularitySource,
    hybridExternalSource?: HybridExternalSource,
    mdblistListId?: number | null,
    mdblistSort?: string,
    languages?: string[],
    includeUnknownLanguage?: boolean,
  ) => {
    if (source === 'emby_history') { if (type === 'movies') setMoviesLibraryMatch(null); else setSeriesLibraryMatch(null); return }
    if (source === 'mdblist' && mdblistListId) { void fetchLibraryMatch(mdblistListId, type, mdblistSort || 'score'); return }
    if (type === 'movies') setMoviesMatchLoading(true); else setSeriesMatchLoading(true)
    try {
      const response = await fetch('/api/top-picks/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ mediaType: type, source, hybridExternalSource, mdblistListId, mdblistSort, limit: 100, languages: languages || [], includeUnknownLanguage: includeUnknownLanguage ?? true }),
      })
      if (response.ok) {
        const data = (await response.json()) as { matched: unknown[]; missing: Array<{ title: string; year: number | null }> }
        const result: LibraryMatchResult = { total: data.matched.length + data.missing.length, matched: data.matched.length, missing: data.missing.map((item) => ({ title: item.title, year: item.year, mediatype: type === 'movies' ? 'movie' : 'show' })) }
        if (type === 'movies') setMoviesLibraryMatch(result); else setSeriesLibraryMatch(result)
      }
    } catch { /* silent */ } finally { if (type === 'movies') setMoviesMatchLoading(false); else setSeriesMatchLoading(false) }
  }, [fetchLibraryMatch])

  useEffect(() => { if (mdblistMoviesListId) void fetchListCounts(mdblistMoviesListId, 'movies'); else setMoviesListCounts(null) }, [mdblistMoviesListId, fetchListCounts])
  useEffect(() => { if (mdblistSeriesListId) void fetchListCounts(mdblistSeriesListId, 'series'); else setSeriesListCounts(null) }, [mdblistSeriesListId, fetchListCounts])

  useEffect(() => {
    if (!moviesPopularitySource) return
    const source = moviesPopularitySource
    if (source === 'emby_history') { setMoviesLibraryMatch(null); return }
    const timeout = setTimeout(() => { void fetchSourcePreview('movies', source, moviesHybridExternalSource, mdblistMoviesListId, mdblistMoviesSort, moviesLanguages, moviesIncludeUnknownLanguage) }, 500)
    return () => clearTimeout(timeout)
  }, [moviesPopularitySource, moviesHybridExternalSource, mdblistMoviesListId, mdblistMoviesSort, moviesLanguages, moviesIncludeUnknownLanguage, fetchSourcePreview])

  useEffect(() => {
    if (!seriesPopularitySource) return
    const source = seriesPopularitySource
    if (source === 'emby_history') { setSeriesLibraryMatch(null); return }
    const timeout = setTimeout(() => { void fetchSourcePreview('series', source, seriesHybridExternalSource, mdblistSeriesListId, mdblistSeriesSort, seriesLanguages, seriesIncludeUnknownLanguage) }, 500)
    return () => clearTimeout(timeout)
  }, [seriesPopularitySource, seriesHybridExternalSource, mdblistSeriesListId, mdblistSeriesSort, seriesLanguages, seriesIncludeUnknownLanguage, fetchSourcePreview])

  const fetchPreviewCounts = useCallback(async (cfg: PreviewCountConfig) => {
    const needsLocalMovies = cfg.moviesPopularitySource === 'emby_history' || cfg.moviesPopularitySource === 'hybrid'
    const needsLocalSeries = cfg.seriesPopularitySource === 'emby_history' || cfg.seriesPopularitySource === 'hybrid'
    if (!needsLocalMovies && !needsLocalSeries) { setPreviewCounts(null); return }
    setPreviewLoading(true)
    try {
      const response = await fetch('/api/settings/top-picks/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ moviesMinViewers: cfg.moviesMinUniqueViewers, moviesTimeWindowDays: cfg.moviesTimeWindowDays, seriesMinViewers: cfg.seriesMinUniqueViewers, seriesTimeWindowDays: cfg.seriesTimeWindowDays }) })
      if (response.ok) setPreviewCounts((await response.json()) as PreviewCounts)
    } catch { /* silent */ } finally { setPreviewLoading(false) }
  }, [])

  useEffect(() => {
    if (!previewConfig) return
    const timeout = setTimeout(() => { void fetchPreviewCounts(previewConfig) }, 300)
    return () => clearTimeout(timeout)
  }, [previewConfig, fetchPreviewCounts])

  const openPreviewModal = useCallback((mediaType: TopPicksMediaType) => { setPreviewModalMediaType(mediaType); setPreviewModalOpen(true) }, [])

  return { previewCounts, previewLoading, moviesLibraryMatch, seriesLibraryMatch, moviesMatchLoading, seriesMatchLoading, moviesMatchExpanded, setMoviesMatchExpanded, seriesMatchExpanded, setSeriesMatchExpanded, previewModalOpen, setPreviewModalOpen, previewModalMediaType, openPreviewModal }
}
