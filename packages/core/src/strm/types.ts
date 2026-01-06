export interface Movie {
  id: string
  providerItemId: string
  title: string
  originalTitle: string | null
  sortTitle: string | null
  year: number | null
  premiereDate: string | Date | null
  path: string | null
  mediaSources: Array<{ path: string }> | null
  // Metadata for NFO generation
  overview: string | null
  tagline: string | null
  communityRating: number | null
  criticRating: number | null
  contentRating: string | null // MPAA rating
  runtimeMinutes: number | null
  genres: string[] | null
  posterUrl: string | null
  backdropUrl: string | null
  // Extended metadata
  studios: Array<string | { id?: string; name: string; imageTag?: string }> | null
  directors: string[] | null
  writers: string[] | null
  actors: Array<{ name: string; role?: string; thumb?: string }> | null
  imdbId: string | null
  tmdbId: string | null
  tags: string[] | null
  productionCountries: string[] | null
  awards: string | null
  videoResolution: string | null
  videoCodec: string | null
  audioCodec: string | null
  container: string | null
  // AI-generated explanation for why this movie was recommended
  aiExplanation: string | null
  // Recommendation ranking data
  rank: number
  matchScore: number // 0-100 percentage
}

export interface StrmConfig {
  strmRoot: string
  libraryRoot: string
  libraryNamePrefix: string
  libraryPathPrefix: string
  useStreamingUrl: boolean
  downloadImages: boolean
}

/**
 * Image download task with optional ranking data for poster overlay
 */
export interface ImageDownloadTask {
  url: string
  path: string
  movieTitle: string
  isPoster: boolean
  rank?: number
  matchScore?: number
  /** Mode for poster overlay: 'recommendation' (default) or 'top-picks' */
  mode?: 'recommendation' | 'top-picks'
}

/**
 * File write task for batched parallel processing
 */
export interface FileWriteTask {
  path: string
  content: string
  movie: Movie
  type: 'strm' | 'nfo'
}

