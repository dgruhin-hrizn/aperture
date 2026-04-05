import type { JustWatchStreamingRow } from './types.js'

function chartPriority(a: JustWatchStreamingRow, b: JustWatchStreamingRow): number {
  const rankA = a.chartRank ?? 99_999
  const rankB = b.chartRank ?? 99_999
  if (rankA !== rankB) return rankA - rankB
  const dA = a.daysInTop10 ?? 0
  const dB = b.daysInTop10 ?? 0
  if (dA !== dB) return dB - dA
  return (a.topRank ?? 99_999) - (b.topRank ?? 99_999)
}

/**
 * Chart order: lowest position number first (#1 before #2). Missing ranks last.
 */
export function sortStreamingRowsForDiscovery(rows: JustWatchStreamingRow[]): JustWatchStreamingRow[] {
  return [...rows].sort((a, b) => chartPriority(a, b))
}
