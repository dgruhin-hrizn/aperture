/**
 * Emby Series Module
 */

import type {
  Series,
  Episode,
  PaginationOptions,
  PaginatedResult,
  WatchedEpisode,
} from '../types.js'
import type { EmbySeries, EmbyEpisode } from './types.js'
import { mapEmbyItemToSeries, mapEmbyItemToEpisode } from './mappers.js'
import { logger, type EmbyProviderBase } from './base.js'

export async function getSeries(
  provider: EmbyProviderBase,
  apiKey: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Series>> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Series',
    Recursive: 'true',
    Fields: [
      'Overview',
      'Genres',
      'ProductionYear',
      'CommunityRating',
      'CriticRating',
      'OriginalTitle',
      'ParentId',
      'SortName',
      'Tagline',
      'OfficialRating',
      'PremiereDate',
      'EndDate',
      'Studios',
      'People',
      'ProviderIds',
      'Tags',
      'ProductionLocations',
      'Awards',
      'Status',
      'AirDays',
      'ChildCount',
      'RecursiveItemCount',
    ].join(','),
    StartIndex: String(options.startIndex || 0),
    Limit: String(options.limit || 100),
    SortBy: options.sortBy || 'SortName',
    SortOrder: options.sortOrder || 'Ascending',
  })

  if (options.parentIds && options.parentIds.length > 0) {
    params.set('ParentId', options.parentIds.join(','))
  }

  logger.info(
    {
      startIndex: options.startIndex || 0,
      limit: options.limit || 100,
      sortBy: options.sortBy || 'SortName',
      parentIds: options.parentIds,
    },
    '📺 Fetching series from Emby'
  )

  const response = await provider.fetch<{
    Items: EmbySeries[]
    TotalRecordCount: number
    StartIndex: number
  }>(`/Items?${params}`, apiKey)

  logger.info(
    {
      returned: response.Items.length,
      totalInLibrary: response.TotalRecordCount,
      startIndex: response.StartIndex,
    },
    `📦 Emby returned ${response.Items.length} series (${response.TotalRecordCount} total in library)`
  )

  return {
    items: response.Items.map((item) => mapEmbyItemToSeries(item, provider.baseUrl)),
    totalRecordCount: response.TotalRecordCount,
    startIndex: response.StartIndex,
  }
}

export async function getSeriesById(
  provider: EmbyProviderBase,
  apiKey: string,
  seriesId: string
): Promise<Series | null> {
  try {
    const item = await provider.fetch<EmbySeries>(
      `/Items/${seriesId}?Fields=Overview,Genres,CommunityRating,CriticRating,Studios,People,ProviderIds,Tags,Status,ChildCount,RecursiveItemCount`,
      apiKey
    )
    return mapEmbyItemToSeries(item, provider.baseUrl)
  } catch {
    return null
  }
}

export async function getEpisodes(
  provider: EmbyProviderBase,
  apiKey: string,
  options: PaginationOptions & { seriesId?: string } = {}
): Promise<PaginatedResult<Episode>> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Episode',
    Recursive: 'true',
    Fields: [
      'Overview',
      'ProductionYear',
      'CommunityRating',
      'PremiereDate',
      'Path',
      'MediaSources',
      'People',
      'SeriesName',
    ].join(','),
    StartIndex: String(options.startIndex || 0),
    Limit: String(options.limit || 100),
    SortBy: options.sortBy || 'SeriesSortName,SortName',
    SortOrder: options.sortOrder || 'Ascending',
  })

  if (options.seriesId) {
    params.set('SeriesId', options.seriesId)
  }

  if (options.parentIds && options.parentIds.length > 0) {
    params.set('ParentId', options.parentIds.join(','))
  }

  logger.info(
    {
      startIndex: options.startIndex || 0,
      limit: options.limit || 100,
      seriesId: options.seriesId,
      parentIds: options.parentIds,
    },
    '📺 Fetching episodes from Emby'
  )

  const response = await provider.fetch<{
    Items: EmbyEpisode[]
    TotalRecordCount: number
    StartIndex: number
  }>(`/Items?${params}`, apiKey)

  logger.info(
    {
      returned: response.Items.length,
      totalInLibrary: response.TotalRecordCount,
      startIndex: response.StartIndex,
    },
    `📦 Emby returned ${response.Items.length} episodes (${response.TotalRecordCount} total)`
  )

  return {
    items: response.Items.map((item) => mapEmbyItemToEpisode(item, provider.baseUrl)),
    totalRecordCount: response.TotalRecordCount,
    startIndex: response.StartIndex,
  }
}

export async function getEpisodeById(
  provider: EmbyProviderBase,
  apiKey: string,
  episodeId: string
): Promise<Episode | null> {
  try {
    const item = await provider.fetch<EmbyEpisode>(
      `/Items/${episodeId}?Fields=Overview,CommunityRating,Path,MediaSources,People,SeriesName`,
      apiKey
    )
    return mapEmbyItemToEpisode(item, provider.baseUrl)
  } catch {
    return null
  }
}

export async function getSeriesWatchHistory(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  sinceDate?: Date
): Promise<WatchedEpisode[]> {
  logger.info({ userId, deltaSync: !!sinceDate }, 'Fetching series watch history from Emby')

  const itemsMap = new Map<string, WatchedEpisode>()

  // Step 1: Fetch all PLAYED episodes (or just recently played for delta sync)
  let startIndex = 0
  const pageSize = 500

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'UserData,UserDataPlayCount,UserDataLastPlayedDate,SeriesId',
      IsPlayed: 'true',
      UserId: userId,
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    // Delta sync: only get items played since last sync
    if (sinceDate) {
      params.set('MinDateLastSavedForUser', sinceDate.toISOString())
    }

    const response = await provider.fetch<{ Items: EmbyEpisode[]; TotalRecordCount: number }>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )

    if (response.Items.length === 0) {
      break
    }

    for (const item of response.Items) {
      if (item.UserData?.Played) {
        itemsMap.set(item.Id, {
          episodeId: item.Id,
          seriesId: item.SeriesId,
          playCount: item.UserData.PlayCount || 0,
          isFavorite: item.UserData.IsFavorite || false,
          lastPlayedDate: item.UserData.LastPlayedDate,
        })
      }
    }

    startIndex += response.Items.length
    if (startIndex >= response.TotalRecordCount) {
      break
    }
  }

  logger.debug({ userId, playedCount: itemsMap.size }, 'Fetched played episodes')

  // Step 2: Fetch all FAVORITE episodes (including unwatched ones)
  const favoritesParams = new URLSearchParams({
    IncludeItemTypes: 'Episode',
    Recursive: 'true',
    Fields: 'UserData,SeriesId',
    IsFavorite: 'true',
    UserId: userId,
  })

  const favoritesResponse = await provider.fetch<{ Items: EmbyEpisode[] }>(
    `/Users/${userId}/Items?${favoritesParams}`,
    apiKey
  )

  let addedFavorites = 0
  for (const item of favoritesResponse.Items) {
    if (!itemsMap.has(item.Id)) {
      itemsMap.set(item.Id, {
        episodeId: item.Id,
        seriesId: item.SeriesId,
        playCount: 0,
        isFavorite: true,
        lastPlayedDate: item.UserData?.LastPlayedDate,
      })
      addedFavorites++
    } else {
      const existing = itemsMap.get(item.Id)!
      existing.isFavorite = true
    }
  }

  logger.debug(
    {
      userId,
      totalFavorites: favoritesResponse.Items.length,
      addedUnwatchedFavorites: addedFavorites,
    },
    'Processed episode favorites'
  )

  // Convert map to array and sort
  const allItems = Array.from(itemsMap.values())

  allItems.sort((a, b) => {
    if (!a.lastPlayedDate && !b.lastPlayedDate) return 0
    if (!a.lastPlayedDate) return 1
    if (!b.lastPlayedDate) return -1
    return b.lastPlayedDate.localeCompare(a.lastPlayedDate)
  })

  logger.info({ userId, totalItems: allItems.length }, 'Series watch history complete')
  return allItems
}

/**
 * Mark a single episode as unplayed/unwatched in Emby
 * This calls DELETE /Users/{UserId}/PlayedItems/{ItemId}
 */
export async function markEpisodeUnplayed(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  episodeProviderId: string
): Promise<void> {
  logger.info({ userId, episodeProviderId }, 'Marking episode as unplayed in Emby')

  await provider.fetch(
    `/Users/${userId}/PlayedItems/${episodeProviderId}`,
    apiKey,
    { method: 'DELETE' }
  )

  logger.info({ userId, episodeProviderId }, 'Episode marked as unplayed')
}

/**
 * Mark all episodes in a season as unplayed/unwatched in Emby
 */
export async function markSeasonUnplayed(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  seriesProviderId: string,
  seasonNumber: number
): Promise<{ markedCount: number }> {
  logger.info({ userId, seriesProviderId, seasonNumber }, 'Marking season as unplayed in Emby')

  // Get all episodes for this season
  const params = new URLSearchParams({
    ParentId: seriesProviderId,
    IncludeItemTypes: 'Episode',
    Recursive: 'true',
    Fields: 'UserData',
    UserId: userId,
  })

  const response = await provider.fetch<{ Items: EmbyEpisode[]; TotalRecordCount: number }>(
    `/Items?${params}`,
    apiKey
  )

  // Filter to just the requested season and episodes that are played
  const seasonEpisodes = response.Items.filter(
    ep => ep.ParentIndexNumber === seasonNumber && ep.UserData?.Played
  )

  // Mark each episode as unplayed
  let markedCount = 0
  for (const episode of seasonEpisodes) {
    try {
      await provider.fetch(
        `/Users/${userId}/PlayedItems/${episode.Id}`,
        apiKey,
        { method: 'DELETE' }
      )
      markedCount++
    } catch (err) {
      logger.warn({ episodeId: episode.Id, err }, 'Failed to mark episode as unplayed')
    }
  }

  logger.info({ userId, seriesProviderId, seasonNumber, markedCount }, 'Season marked as unplayed')
  return { markedCount }
}

/**
 * Mark all episodes in a series as unplayed/unwatched in Emby
 */
export async function markSeriesUnplayed(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  seriesProviderId: string
): Promise<{ markedCount: number }> {
  logger.info({ userId, seriesProviderId }, 'Marking entire series as unplayed in Emby')

  // Get all episodes for this series
  const params = new URLSearchParams({
    ParentId: seriesProviderId,
    IncludeItemTypes: 'Episode',
    Recursive: 'true',
    Fields: 'UserData',
    UserId: userId,
  })

  const response = await provider.fetch<{ Items: EmbyEpisode[]; TotalRecordCount: number }>(
    `/Items?${params}`,
    apiKey
  )

  // Filter to only played episodes
  const playedEpisodes = response.Items.filter(ep => ep.UserData?.Played)

  // Mark each episode as unplayed
  let markedCount = 0
  for (const episode of playedEpisodes) {
    try {
      await provider.fetch(
        `/Users/${userId}/PlayedItems/${episode.Id}`,
        apiKey,
        { method: 'DELETE' }
      )
      markedCount++
    } catch (err) {
      logger.warn({ episodeId: episode.Id, err }, 'Failed to mark episode as unplayed')
    }
  }

  logger.info({ userId, seriesProviderId, markedCount }, 'Series marked as unplayed')
  return { markedCount }
}
