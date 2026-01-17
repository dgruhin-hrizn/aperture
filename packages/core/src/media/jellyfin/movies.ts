/**
 * Jellyfin Movies Module
 */

import type { Movie, PaginationOptions, PaginatedResult, WatchedItem } from '../types.js'
import type { JellyfinItem, JellyfinItemsResponse } from './types.js'
import { mapJellyfinItemToMovie } from './mappers.js'
import { logger, type JellyfinProviderBase } from './base.js'

export async function getMovies(
  provider: JellyfinProviderBase,
  apiKey: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Movie>> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Movie',
    Recursive: 'true',
    Fields: [
      'Overview',
      'Genres',
      'ProductionYear',
      'CommunityRating',
      'CriticRating',
      'Path',
      'MediaSources',
      'OriginalTitle',
      'ParentId',
      'SortName',
      'Tagline',
      'OfficialRating',
      'PremiereDate',
      'Studios',
      'People',
      'ProviderIds',
      'Tags',
      'ProductionLocations',
      'Awards',
      'ImageTags',
      'BackdropImageTags',
    ].join(','),
    StartIndex: String(options.startIndex || 0),
    Limit: String(options.limit || 100),
    SortBy: options.sortBy || 'SortName',
    SortOrder: options.sortOrder || 'Ascending',
  })

  // Filter by parent library IDs if provided
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
    '🎬 Fetching movies from Jellyfin'
  )

  const response = await provider.fetch<JellyfinItemsResponse>(`/Items?${params}`, apiKey)

  logger.info(
    {
      returned: response.Items.length,
      totalInLibrary: response.TotalRecordCount,
      startIndex: response.StartIndex,
    },
    `📦 Jellyfin returned ${response.Items.length} movies (${response.TotalRecordCount} total in library)`
  )

  return {
    items: response.Items.map((item) => mapJellyfinItemToMovie(item, provider.baseUrl)),
    totalRecordCount: response.TotalRecordCount,
    startIndex: response.StartIndex,
  }
}

export async function getMovieById(
  provider: JellyfinProviderBase,
  apiKey: string,
  movieId: string
): Promise<Movie | null> {
  try {
    const item = await provider.fetch<JellyfinItem>(
      `/Items/${movieId}?Fields=Overview,Genres,CommunityRating,CriticRating,Path,MediaSources,Studios,People,ProviderIds,Tags`,
      apiKey
    )
    return mapJellyfinItemToMovie(item, provider.baseUrl)
  } catch {
    return null
  }
}

export async function getWatchHistory(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  sinceDate?: Date
): Promise<WatchedItem[]> {
  logger.info({ userId, deltaSync: !!sinceDate }, 'Fetching watch history from Jellyfin')

  const itemsMap = new Map<string, WatchedItem>()

  // Step 1: Fetch all PLAYED movies (or just recently played for delta sync)
  let startIndex = 0
  const pageSize = 500

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      // Include ProviderIds for aperture-prefix detection (watch history attribution)
      Fields: 'UserData,ProviderIds',
      IsPlayed: 'true',
      UserId: userId,
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    // Delta sync: only get items played since last sync
    if (sinceDate) {
      params.set('MinDateLastSavedForUser', sinceDate.toISOString())
    }

    const response = await provider.fetch<JellyfinItemsResponse>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )

    if (response.Items.length === 0) {
      break
    }

    for (const item of response.Items) {
      if (item.UserData?.Played) {
        itemsMap.set(item.Id, {
          movieId: item.Id,
          playCount: item.UserData.PlayCount || 0,
          isFavorite: item.UserData.IsFavorite || false,
          lastPlayedDate: item.UserData.LastPlayedDate,
          // Include provider IDs for aperture-prefix detection
          providerIds: item.ProviderIds ? {
            imdb: item.ProviderIds.Imdb,
            tmdb: item.ProviderIds.Tmdb,
          } : undefined,
        })
      }
    }

    startIndex += response.Items.length
    if (startIndex >= response.TotalRecordCount) {
      break
    }
  }

  logger.debug({ userId, playedCount: itemsMap.size }, 'Fetched played movies')

  // Step 2: Fetch all FAVORITES (including unwatched ones)
  const favoritesParams = new URLSearchParams({
    IncludeItemTypes: 'Movie',
    Recursive: 'true',
    Fields: 'UserData',
    IsFavorite: 'true',
    UserId: userId,
  })

  const favoritesResponse = await provider.fetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items?${favoritesParams}`,
    apiKey
  )

  let addedFavorites = 0
  for (const item of favoritesResponse.Items) {
    if (!itemsMap.has(item.Id)) {
      itemsMap.set(item.Id, {
        movieId: item.Id,
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
    'Processed favorites'
  )

  // Convert map to array and sort
  const allItems = Array.from(itemsMap.values())

  allItems.sort((a, b) => {
    if (!a.lastPlayedDate && !b.lastPlayedDate) return 0
    if (!a.lastPlayedDate) return 1
    if (!b.lastPlayedDate) return -1
    return b.lastPlayedDate.localeCompare(a.lastPlayedDate)
  })

  logger.info(
    { userId, totalItems: allItems.length, favorites: favoritesResponse.Items.length },
    'Watch history complete'
  )
  return allItems
}

/**
 * Mark a movie as played/watched in Jellyfin
 * This calls POST /Users/{UserId}/PlayedItems/{ItemId}
 * Used for watch history attribution from Aperture items to originals
 */
export async function markMoviePlayed(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  movieProviderId: string
): Promise<void> {
  logger.info({ userId, movieProviderId }, 'Marking movie as played in Jellyfin')

  await provider.fetch(
    `/Users/${userId}/PlayedItems/${movieProviderId}`,
    apiKey,
    { method: 'POST' }
  )

  logger.info({ userId, movieProviderId }, 'Movie marked as played')
}

/**
 * Mark a movie as unplayed/unwatched in Jellyfin
 * This calls DELETE /Users/{UserId}/PlayedItems/{ItemId}
 */
export async function markMovieUnplayed(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  movieProviderId: string
): Promise<void> {
  logger.info({ userId, movieProviderId }, 'Marking movie as unplayed in Jellyfin')

  await provider.fetch(
    `/Users/${userId}/PlayedItems/${movieProviderId}`,
    apiKey,
    { method: 'DELETE' }
  )

  logger.info({ userId, movieProviderId }, 'Movie marked as unplayed')
}

