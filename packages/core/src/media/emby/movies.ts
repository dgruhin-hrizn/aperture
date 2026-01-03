/**
 * Emby Movies Module
 */

import type { Movie, PaginationOptions, PaginatedResult, WatchedItem } from '../types.js'
import type { EmbyItem, EmbyItemsResponse, EmbyActivityResponse } from './types.js'
import { mapEmbyItemToMovie } from './mappers.js'
import { logger, type EmbyProviderBase } from './base.js'

export async function getMovies(
  provider: EmbyProviderBase,
  apiKey: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Movie>> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Movie',
    Recursive: 'true',
    // Request comprehensive metadata from Emby
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
    '🎬 Fetching movies from Emby'
  )

  const response = await provider.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)

  // Log detailed info about response
  logger.info(
    {
      returned: response.Items.length,
      totalInLibrary: response.TotalRecordCount,
      startIndex: response.StartIndex,
    },
    `📦 Emby returned ${response.Items.length} movies (${response.TotalRecordCount} total in library)`
  )

  // Log sample of first few movies for debugging
  if (response.Items.length > 0) {
    const samples = response.Items.slice(0, 3).map((item) => ({
      id: item.Id,
      name: item.Name,
      year: item.ProductionYear,
      genres: item.Genres?.slice(0, 3),
      hasOverview: !!item.Overview,
      hasPath: !!item.Path,
      rating: item.CommunityRating,
    }))
    logger.debug({ samples }, '🎥 Sample movies from this batch')

    // Log first movie in detail for debugging structure
    if (options.startIndex === 0 || options.startIndex === undefined) {
      const firstItem = response.Items[0]
      logger.info(
        {
          rawItem: {
            Id: firstItem.Id,
            Name: firstItem.Name,
            OriginalTitle: firstItem.OriginalTitle,
            ProductionYear: firstItem.ProductionYear,
            Genres: firstItem.Genres,
            Overview:
              firstItem.Overview?.substring(0, 100) +
              (firstItem.Overview && firstItem.Overview.length > 100 ? '...' : ''),
            CommunityRating: firstItem.CommunityRating,
            CriticRating: firstItem.CriticRating,
            RunTimeTicks: firstItem.RunTimeTicks,
            Path: firstItem.Path,
            MediaSourcesCount: firstItem.MediaSources?.length,
            ImageTags: firstItem.ImageTags,
            BackdropImageTags: firstItem.BackdropImageTags,
          },
        },
        '🔍 First movie raw structure (for debugging)'
      )
    }
  }

  return {
    items: response.Items.map((item) => mapEmbyItemToMovie(item, provider.baseUrl)),
    totalRecordCount: response.TotalRecordCount,
    startIndex: response.StartIndex,
  }
}

export async function getMovieById(
  provider: EmbyProviderBase,
  apiKey: string,
  movieId: string
): Promise<Movie | null> {
  try {
    const item = await provider.fetch<EmbyItem>(
      `/Items/${movieId}?Fields=Overview,Genres,CommunityRating,CriticRating,Path,MediaSources`,
      apiKey
    )
    return mapEmbyItemToMovie(item, provider.baseUrl)
  } catch {
    return null
  }
}

export async function getWatchHistory(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  sinceDate?: Date
): Promise<WatchedItem[]> {
  logger.info({ userId, sinceDate: sinceDate?.toISOString() }, 'Fetching watch history from Emby')

  // Use Items API with full UserData fields - this gets ALL watched items with proper data
  return getWatchHistoryFromItems(provider, apiKey, userId, sinceDate)
}

/**
 * Get watch history from Items API with full UserData fields
 * This returns ALL watched items with proper PlayCount and LastPlayedDate,
 * PLUS any unwatched favorites (so favorites count is accurate)
 * 
 * @param sinceDate - If provided, only return items played since this date (delta sync)
 */
async function getWatchHistoryFromItems(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  sinceDate?: Date
): Promise<WatchedItem[]> {
  logger.info({ userId, deltaSync: !!sinceDate }, 'Fetching watch history from Items API with full UserData')

  const itemsMap = new Map<string, WatchedItem>()

  // Step 1: Fetch all PLAYED movies (or just recently played for delta sync)
  let startIndex = 0
  const pageSize = 500

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      Fields: 'UserData,UserDataPlayCount,UserDataLastPlayedDate',
      IsPlayed: 'true',
      UserId: userId,
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    // Delta sync: only get items played since last sync
    if (sinceDate) {
      params.set('MinDateLastSavedForUser', sinceDate.toISOString())
    }

    const response = await provider.fetch<EmbyItemsResponse>(
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

  const favoritesResponse = await provider.fetch<EmbyItemsResponse>(
    `/Users/${userId}/Items?${favoritesParams}`,
    apiKey
  )

  let addedFavorites = 0
  for (const item of favoritesResponse.Items) {
    if (!itemsMap.has(item.Id)) {
      // This is a favorite that hasn't been played - add it
      itemsMap.set(item.Id, {
        movieId: item.Id,
        playCount: 0,
        isFavorite: true,
        lastPlayedDate: item.UserData?.LastPlayedDate,
      })
      addedFavorites++
    } else {
      // Movie is already in the map (played), ensure favorite flag is set
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

  // Sort by last played date (most recent first), then favorites without play date
  allItems.sort((a, b) => {
    if (!a.lastPlayedDate && !b.lastPlayedDate) return 0
    if (!a.lastPlayedDate) return 1
    if (!b.lastPlayedDate) return -1
    return b.lastPlayedDate.localeCompare(a.lastPlayedDate)
  })

  logger.info(
    { userId, totalItems: allItems.length, favorites: favoritesResponse.Items.length },
    'Watch history from Items API complete'
  )
  return allItems
}

/**
 * Alternative method using Activity Log (useful for getting very recent playback data)
 * This is kept for reference but getWatchHistoryFromItems now works correctly
 */
export async function getWatchHistoryFromActivityLog(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  getUsers: (provider: EmbyProviderBase, apiKey: string) => Promise<{ id: string; name: string }[]>
): Promise<WatchedItem[]> {
  logger.info({ userId }, 'Fetching watch history using Activity Log')

  // First, get the user's display name (needed to match Activity Log entries)
  const users = await getUsers(provider, apiKey)
  const user = users.find((u) => u.id === userId)
  if (!user) {
    logger.warn({ userId }, 'User not found for Activity Log method')
    return []
  }

  const username = user.name
  logger.debug({ userId, username }, 'Found user, fetching Activity Log')

  // Get recent playback from Activity Log (last 10000 entries should be plenty)
  const activityResponse = await provider.fetch<EmbyActivityResponse>(
    `/System/ActivityLog/Entries?Limit=10000&hasUserId=true`,
    apiKey
  )

  // Filter to this user's movie playback events
  // Activity Log names look like: "Username has finished playing Movie Title on Device"
  const userPlaybackEvents = activityResponse.Items.filter((entry) => {
    return (
      entry.Type === 'playback.stop' &&
      entry.Name.startsWith(`${username} has finished playing`) &&
      entry.ItemId &&
      // Exclude TV episodes (they have " - S" or " - Ep" in the name)
      !entry.Name.includes(' - S') &&
      !entry.Name.includes(' - Ep')
    )
  })

  logger.info(
    { userId, username, playbackEvents: userPlaybackEvents.length },
    'Found playback events in Activity Log'
  )

  // Aggregate by ItemId to get play counts and last played dates
  const playbackMap = new Map<string, { count: number; lastPlayed: string }>()
  for (const event of userPlaybackEvents) {
    if (!event.ItemId) continue

    const existing = playbackMap.get(event.ItemId)
    if (existing) {
      existing.count++
      // Keep the most recent date
      if (event.Date > existing.lastPlayed) {
        existing.lastPlayed = event.Date
      }
    } else {
      playbackMap.set(event.ItemId, { count: 1, lastPlayed: event.Date })
    }
  }

  logger.debug({ uniqueMovies: playbackMap.size }, 'Aggregated playback data')

  // Also get favorites from the Items API
  const favoritesParams = new URLSearchParams({
    IncludeItemTypes: 'Movie',
    Recursive: 'true',
    Fields: 'UserData',
    IsFavorite: 'true',
    UserId: userId,
  })
  const favoritesResponse = await provider.fetch<EmbyItemsResponse>(
    `/Users/${userId}/Items?${favoritesParams}`,
    apiKey
  )
  const favoriteIds = new Set(favoritesResponse.Items.map((item) => item.Id))
  logger.debug({ favorites: favoriteIds.size }, 'Found favorite movies')

  // Build watch history from Activity Log data
  const watchedItems: WatchedItem[] = []

  for (const [movieId, data] of playbackMap) {
    watchedItems.push({
      movieId,
      playCount: data.count,
      isFavorite: favoriteIds.has(movieId),
      lastPlayedDate: data.lastPlayed,
    })
  }

  // Also add favorites that weren't in the Activity Log
  for (const item of favoritesResponse.Items) {
    if (!playbackMap.has(item.Id)) {
      watchedItems.push({
        movieId: item.Id,
        playCount: 0,
        isFavorite: true,
        lastPlayedDate: item.UserData?.LastPlayedDate,
      })
    }
  }

  // Sort by last played date (most recent first)
  watchedItems.sort((a, b) => {
    if (!a.lastPlayedDate && !b.lastPlayedDate) return 0
    if (!a.lastPlayedDate) return 1
    if (!b.lastPlayedDate) return -1
    return b.lastPlayedDate.localeCompare(a.lastPlayedDate)
  })

  logger.info({ userId, totalWatched: watchedItems.length }, 'Watch history complete')
  return watchedItems
}

