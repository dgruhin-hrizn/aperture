/**
 * Type definitions for Tool UI components
 * These mirror the schemas from the backend
 */

export interface Action {
  id: string
  label: string
  href?: string
  variant?: 'default' | 'secondary' | 'primary'
}

export interface ContentItem {
  id: string
  type: 'movie' | 'series'
  name: string
  subtitle?: string
  image?: string | null
  rating?: number | null
  userRating?: number | null
  rank?: number
  actions?: Action[]
}

/** Mirrors API `ContentCarouselI18nKey` allowlist (client resolves under `assistantToolUi.<key>`). */
export type ContentCarouselI18nKey =
  | 'carouselRecommendationsTitle'
  | 'carouselRecommendationsDesc'
  | 'carouselRecommendationsEmpty'
  | 'carouselTopRatedTitle'
  | 'carouselTopRatedGenreTitle'
  | 'carouselUnwatchedTitle'
  | 'carouselUnwatchedDesc'
  | 'carouselWatchHistoryTitle'
  | 'carouselWatchHistoryDesc'
  | 'carouselRatingsTitle'
  | 'carouselRatingsDesc'
  | 'carouselRankingSeriesMostEpisodes'
  | 'carouselRankingSeriesMostSeasons'
  | 'carouselRankingHighestRatedSeries'
  | 'carouselRankingLowestRatedSeries'
  | 'carouselRankingNewestSeries'
  | 'carouselRankingOldestSeries'
  | 'carouselRankingLongestMovies'
  | 'carouselRankingHighestRatedMovies'
  | 'carouselRankingLowestRatedMovies'
  | 'carouselRankingNewestMovies'
  | 'carouselRankingOldestMovies'
  | 'carouselSearchTitleDefault'
  | 'carouselSearchTitleQuery'
  | 'carouselSearchTitleGenreMovies'
  | 'carouselSearchTitleGenreSeries'
  | 'carouselSearchTitleGenreBoth'
  | 'carouselSearchNoResults'
  | 'carouselSemanticTitleMovies'
  | 'carouselSemanticTitleSeries'
  | 'carouselSemanticTitleBoth'
  | 'carouselSemanticEmpty'
  | 'carouselSemanticDesc'
  | 'carouselSemanticError'
  | 'carouselSimilarTitle'
  | 'carouselSimilarLookupNotFound'
  | 'carouselSimilarNoEmbedding'
  | 'carouselSimilarEmptyMovie'
  | 'carouselSimilarEmptySeries'
  | 'carouselSimilarDescMovie'
  | 'carouselSimilarDescSeries'
  | 'carouselSimilarDescMovieUnwatched'
  | 'carouselSimilarDescSeriesUnwatched'
  | 'carouselSimilarError'

export interface ContentCarouselData {
  id: string
  title?: string
  description?: string
  titleKey?: ContentCarouselI18nKey
  descriptionKey?: ContentCarouselI18nKey
  titleParams?: Record<string, string | number>
  descriptionParams?: Record<string, string | number>
  items: ContentItem[]
}

export interface FilmographyItem {
  id: string
  type: 'movie' | 'series'
  title: string
  year?: number | null
  role?: string | null
}

export interface Person {
  name: string
  role: 'actor' | 'director' | 'writer'
  thumb?: string | null
  filmography: FilmographyItem[]
}

export interface PersonResultData {
  id: string
  people: Person[]
  error?: string
}

export interface StatsData {
  id: string
  movieCount: number
  seriesCount: number
  episodeCount?: number
  totalRuntimeMinutes?: number
  totalRuntimeFormatted?: string
  averageRating?: number | null
  topGenres?: Array<{ genre: string; count: number }>
  watchStats?: {
    moviesWatched: number
    seriesStarted: number
    totalPlayCount: number
  }
  ratingStats?: {
    totalRated: number
    averageUserRating: number | null
  }
}

export interface StudiosData {
  id: string
  studios?: Array<{
    name: string
    movieCount: number
    topTitles: Array<{ id: string; type: 'movie'; title: string }>
  }>
  networks?: Array<{
    name: string
    seriesCount: number
    topTitles: Array<{ id: string; type: 'series'; title: string }>
  }>
}

export interface ContentDetailData {
  id: string
  type: 'movie' | 'series'
  contentId: string
  name: string
  year?: number | null
  yearRange?: string | null
  tagline?: string | null
  overview?: string | null
  genres?: string[]
  image?: string | null
  runtime?: string | null
  director?: string | null
  cast?: string[]
  network?: string | null
  status?: string | null
  seasonCount?: number
  episodeCount?: number
  communityRating?: number | null
  criticRating?: number | null
  contentRating?: string | null
  userRating?: number | null
  isWatched?: boolean
  playCount?: number
  episodesWatched?: number
  lastWatched?: string | null
  actions: Action[]
}


