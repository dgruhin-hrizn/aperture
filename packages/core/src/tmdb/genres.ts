/**
 * TMDb genre lists (localized via `language` on the client).
 */

import { tmdbRequest, type ApiLogCallback } from './client.js'
import type { TMDbGenre } from './types.js'

export async function getMovieGenresList(options: {
  language?: string
  onLog?: ApiLogCallback
} = {}): Promise<TMDbGenre[]> {
  const data = await tmdbRequest<{ genres: TMDbGenre[] }>(`/genre/movie/list`, options)
  return data?.genres ?? []
}

export async function getTVGenresList(options: {
  language?: string
  onLog?: ApiLogCallback
} = {}): Promise<TMDbGenre[]> {
  const data = await tmdbRequest<{ genres: TMDbGenre[] }>(`/genre/tv/list`, options)
  return data?.genres ?? []
}
