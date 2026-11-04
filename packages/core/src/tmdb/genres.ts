/**
 * TMDb genre lists (localized via `language` on the client).
 */

import { AsyncCache } from '../lib/asyncCache.js'
import { tmdbRequest, type ApiLogCallback } from './client.js'
import type { TMDbGenre } from './types.js'

const genresCache = new AsyncCache<{ genres: TMDbGenre[] } | null>(60 * 60_000, 100)

export async function getMovieGenresList(options: {
  language?: string
  onLog?: ApiLogCallback
} = {}): Promise<TMDbGenre[]> {
  const data = await genresCache.get(`movie:${options.language ?? ''}`, () => tmdbRequest<{ genres: TMDbGenre[] }>(`/genre/movie/list`, options))
  return data?.genres ?? []
}

export async function getTVGenresList(options: {
  language?: string
  onLog?: ApiLogCallback
} = {}): Promise<TMDbGenre[]> {
  const data = await genresCache.get(`tv:${options.language ?? ''}`, () => tmdbRequest<{ genres: TMDbGenre[] }>(`/genre/tv/list`, options))
  return data?.genres ?? []
}
