import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { COMMON_LANGUAGES, KNOWN_LANGUAGE_CODES } from './constants'
import type { HybridSourceOption, PopularitySource, SortOption, SourceOption } from './types'

export function useTopPicksOptions() {
  const { t } = useTranslation()
  const getLanguageName = useCallback((code: string) => t(`topPicksAdmin.languages.${code}`, { defaultValue: code.toUpperCase() }), [t])
  const extendedLanguageCodes = useMemo(() => [...KNOWN_LANGUAGE_CODES].filter((code) => !(COMMON_LANGUAGES as readonly string[]).includes(code)).sort((a,b)=>getLanguageName(a).localeCompare(getLanguageName(b))), [getLanguageName])
  const sortOptions = useMemo<SortOption[]>(() => [
    { value: 'score', label: t('topPicksAdmin.sortOptions.score') },
    { value: 'score_average', label: t('topPicksAdmin.sortOptions.score_average') },
    { value: 'imdbrating', label: t('topPicksAdmin.sortOptions.imdbrating') },
    { value: 'imdbvotes', label: t('topPicksAdmin.sortOptions.imdbvotes') },
    { value: 'imdbpopular', label: t('topPicksAdmin.sortOptions.imdbpopular') },
    { value: 'tmdbpopular', label: t('topPicksAdmin.sortOptions.tmdbpopular') },
    { value: 'rtomatoes', label: t('topPicksAdmin.sortOptions.rtomatoes') },
    { value: 'metacritic', label: t('topPicksAdmin.sortOptions.metacritic') },
  ], [t])
  const sourceOptions = useMemo<SourceOption[]>(() => [
    { value: 'emby_history', label: t('topPicksAdmin.sources.emby_history.label'), description: t('topPicksAdmin.sources.emby_history.description'), icon: 'home' },
    { value: 'tmdb_popular', label: t('topPicksAdmin.sources.tmdb_popular.label'), description: t('topPicksAdmin.sources.tmdb_popular.description'), icon: 'tmdb' },
    { value: 'tmdb_trending_day', label: t('topPicksAdmin.sources.tmdb_trending_day.label'), description: t('topPicksAdmin.sources.tmdb_trending_day.description'), icon: 'tmdb' },
    { value: 'tmdb_trending_week', label: t('topPicksAdmin.sources.tmdb_trending_week.label'), description: t('topPicksAdmin.sources.tmdb_trending_week.description'), icon: 'tmdb' },
    { value: 'tmdb_top_rated', label: t('topPicksAdmin.sources.tmdb_top_rated.label'), description: t('topPicksAdmin.sources.tmdb_top_rated.description'), icon: 'tmdb' },
    { value: 'mdblist', label: t('topPicksAdmin.sources.mdblist.label'), description: t('topPicksAdmin.sources.mdblist.description'), icon: 'mdblist', requiresMdblist: true },
    { value: 'hybrid', label: t('topPicksAdmin.sources.hybrid.label'), description: t('topPicksAdmin.sources.hybrid.description'), icon: 'hybrid' },
  ], [t])
  const hybridExternalOptions = useMemo<HybridSourceOption[]>(() => [
    { value: 'tmdb_popular', label: t('topPicksAdmin.sources.tmdb_popular.label') },
    { value: 'tmdb_trending_day', label: t('topPicksAdmin.sources.tmdb_trending_day.label') },
    { value: 'tmdb_trending_week', label: t('topPicksAdmin.sources.tmdb_trending_week.label') },
    { value: 'tmdb_top_rated', label: t('topPicksAdmin.sources.tmdb_top_rated.label') },
    { value: 'mdblist', label: t('topPicksAdmin.sources.mdblist.label'), requiresMdblist: true },
  ], [t])
  const getSourceName = useCallback((source: PopularitySource) => sourceOptions.find((o) => o.value === source)?.label || source, [sourceOptions])
  return { sortOptions, sourceOptions, hybridExternalOptions, extendedLanguageCodes, getLanguageName, getSourceName }
}
