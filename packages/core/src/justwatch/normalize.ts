import type { JustWatchProviderOption, JustWatchStreamingRow } from './types.js'

/** Raw node shape from GetPopularTitles / GetSearchTitles (minimal fields we read) */
export interface JwTitleNode {
  id?: string
  objectId?: number
  objectType?: string
  content?: {
    title?: string | null
    originalReleaseYear?: number | null
    shortDescription?: string | null
    externalIds?: { imdbId?: string | null; tmdbId?: string | number | null } | null
    posterUrl?: string | null
  } | null
  streamingCharts?: {
    edges?: Array<{
      streamingChartInfo?: {
        rank?: number | null
        trend?: string | null
        daysInTop10?: number | null
        topRank?: number | null
      } | null
    }>
  } | null
}

function parseTmdbId(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function firstChartInfo(node: JwTitleNode) {
  const edges = node.streamingCharts?.edges
  if (!edges?.length) return null
  return edges[0]?.streamingChartInfo ?? null
}

export function normalizeJwNode(node: JwTitleNode): JustWatchStreamingRow | null {
  const content = node.content
  if (!content?.title) return null

  const tmdbId = parseTmdbId(content.externalIds?.tmdbId ?? null)
  const objectType = node.objectType || ''

  const chart = firstChartInfo(node)

  return {
    jwNodeId: node.id || String(node.objectId ?? ''),
    objectId: node.objectId ?? 0,
    objectType,
    title: content.title,
    releaseYear: content.originalReleaseYear ?? null,
    overview: content.shortDescription ?? null,
    tmdbId,
    imdbId: content.externalIds?.imdbId ?? null,
    posterPath: content.posterUrl ?? null,
    chartRank: chart?.rank ?? null,
    chartTrend: chart?.trend ?? null,
    daysInTop10: chart?.daysInTop10 ?? null,
    topRank: chart?.topRank ?? null,
    inLibrary: false,
  }
}

export function parsePopularEdges(data: unknown): JustWatchStreamingRow[] {
  const d = data as {
    data?: { popularTitles?: { edges?: Array<{ node?: JwTitleNode }> } }
  }
  const edges = d?.data?.popularTitles?.edges
  if (!edges?.length) return []
  const out: JustWatchStreamingRow[] = []
  for (const e of edges) {
    if (!e?.node) continue
    const row = normalizeJwNode(e.node)
    if (row) out.push(row)
  }
  return out
}

/** GetSearchTitles uses the same `popularTitles` root field in the vendored query. */
export const parseSearchEdges = parsePopularEdges

export function parseProvidersResponse(data: unknown): JustWatchProviderOption[] {
  const d = data as {
    data?: {
      packages?: Array<{
        packageId?: number
        technicalName?: string
        shortName?: string
        clearName?: string
      }>
    }
  }
  const pkgs = d?.data?.packages
  if (!Array.isArray(pkgs)) return []
  const out: JustWatchProviderOption[] = []
  for (const p of pkgs) {
    if (p?.packageId == null || !p.technicalName) continue
    out.push({
      packageId: Number(p.packageId),
      technicalName: String(p.technicalName),
      shortName: String(p.shortName ?? p.technicalName),
      clearName: String(p.clearName ?? p.shortName ?? p.technicalName),
    })
  }
  return out
}
