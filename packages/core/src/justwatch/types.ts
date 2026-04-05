/**
 * Normalized JustWatch streaming row for Discovery UI
 */
export interface JustWatchStreamingRow {
  jwNodeId: string
  objectId: number
  objectType: 'MOVIE' | 'SHOW' | string
  title: string
  releaseYear: number | null
  overview: string | null
  tmdbId: number | null
  imdbId: string | null
  posterPath: string | null
  chartRank: number | null
  chartTrend: string | null
  daysInTop10: number | null
  topRank: number | null
  inLibrary: boolean
  /** When known, local Aperture id */
  localMovieId?: string | null
  localSeriesId?: string | null
}

export interface JustWatchProviderOption {
  packageId: number
  technicalName: string
  shortName: string
  clearName: string
}
