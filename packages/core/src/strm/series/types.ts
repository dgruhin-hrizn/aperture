/**
 * Series STRM/NFO Types
 *
 * Type definitions for series NFO generation, mirroring the movies types.
 */

export interface Actor {
  name: string
  role?: string
  type?: string // 'Actor', 'Producer', etc.
  thumb?: string
  tmdbId?: string
  imdbId?: string
  tvdbId?: string
  tvmazeId?: string
}

export interface Series {
  id: string
  providerItemId: string
  title: string
  originalTitle: string | null
  sortTitle: string | null
  year: number | null
  endYear: number | null
  premiereDate: string | Date | null
  // Metadata for NFO generation
  overview: string | null
  tagline: string | null
  communityRating: number | null
  criticRating: number | null
  contentRating: string | null
  runtimeMinutes: number | null // Average episode runtime
  genres: string[] | null
  posterUrl: string | null
  backdropUrl: string | null
  // Extended metadata
  studios: Array<string | { id?: string; name: string; imageTag?: string }> | null
  directors: string[] | null // Creators/showrunners
  writers: string[] | null
  actors: Actor[] | null
  imdbId: string | null
  tmdbId: string | null
  tvdbId: string | null
  tvmazeId: string | null
  tags: string[] | null
  productionCountries: string[] | null
  awards: string | null
  // Series-specific
  status: string | null
  network: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  airDays: string[] | null
  // AI-generated explanation
  aiExplanation: string | null
  // Recommendation ranking data
  rank: number
  matchScore: number // 0-100 percentage
}

export interface SeriesImageDownloadTask {
  url: string
  path: string
  seriesTitle: string
  isPoster: boolean
  rank?: number
  matchScore?: number
  mode?: 'recommendation' | 'top-picks'
}

export interface NfoGenerateOptions {
  /** Include remote image URLs in NFO (when images not downloaded locally) */
  includeImageUrls: boolean
  /** Date to set as "date added" (affects sorting by recency) */
  dateAdded?: Date
  /** Include AI explanation of why this was recommended (default: true) */
  includeAiExplanation?: boolean
  /** Prefix provider IDs with "aperture-" to prevent duplicate Continue Watching entries */
  prefixProviderIds?: boolean
}



