import type { TFunction } from 'i18next'

const SOURCE_TO_KEY: Record<string, string> = {
  justwatch_streaming: 'justwatchStreaming',
  tmdb_genre_row: 'tmdbGenreRow',
  tmdb_recommendations: 'tmdbRecommendations',
  tmdb_similar: 'tmdbSimilar',
  tmdb_discover: 'tmdbDiscover',
  trakt_trending: 'traktTrending',
  trakt_popular: 'traktPopular',
  trakt_recommendations: 'traktRecommendations',
  mdblist: 'mdblist',
}

/**
 * Localized label for a discovery candidate `source` field (TMDb, Trakt, etc.).
 * Use `variant: 'detail'` for the detail modal where TMDb discover uses a longer label.
 */
export function discoverySourceLabel(
  source: string,
  t: TFunction,
  variant: 'default' | 'detail' = 'default'
): string {
  if (source === 'tmdb_discover' && variant === 'detail') {
    return t('discovery.sources.tmdbDiscoverDetail')
  }
  const k = SOURCE_TO_KEY[source]
  if (k) return t(`discovery.sources.${k}`)
  return source
}
