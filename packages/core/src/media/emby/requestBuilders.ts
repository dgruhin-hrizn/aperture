/**
 * Emby API request builders — URL params and endpoint paths for items, playlists, and collections.
 */

import type { PaginationOptions } from '../types.js'

export const MOVIE_LIST_FIELDS = [
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
] as const

export const SERIES_LIST_FIELDS = [
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
  'ImageTags',
  'BackdropImageTags',
] as const

export const EPISODE_LIST_FIELDS = [
  'Overview',
  'ProductionYear',
  'CommunityRating',
  'PremiereDate',
  'Path',
  'MediaSources',
  'People',
  'SeriesName',
] as const

export const MOVIE_WATCH_FIELDS =
  'UserData,UserDataPlayCount,UserDataLastPlayedDate,ProviderIds,RunTimeTicks'

export const EPISODE_WATCH_FIELDS =
  'UserData,UserDataPlayCount,UserDataLastPlayedDate,SeriesId,ParentIndexNumber,IndexNumber,ProviderIds,RunTimeTicks'

export function buildItemSearchParams(options: {
  includeItemTypes: string
  searchTerm: string
  recursive?: boolean
  userId?: string
}): URLSearchParams {
  const params = new URLSearchParams({
    IncludeItemTypes: options.includeItemTypes,
    Recursive: String(options.recursive ?? true),
    SearchTerm: options.searchTerm,
  })

  if (options.userId) {
    params.set('UserId', options.userId)
  }

  return params
}

export function buildPaginatedItemsParams(
  options: PaginationOptions & {
    includeItemTypes: string
    fields: readonly string[]
    defaultSortBy?: string
    seriesId?: string
  }
): URLSearchParams {
  const params = new URLSearchParams({
    IncludeItemTypes: options.includeItemTypes,
    Recursive: 'true',
    Fields: options.fields.join(','),
    StartIndex: String(options.startIndex || 0),
    Limit: String(options.limit || 100),
    SortBy: options.sortBy || options.defaultSortBy || 'SortName',
    SortOrder: options.sortOrder || 'Ascending',
  })

  if (options.parentIds && options.parentIds.length > 0) {
    params.set('ParentId', options.parentIds.join(','))
  }

  if (options.seriesId) {
    params.set('SeriesId', options.seriesId)
  }

  return params
}

export function buildPlaylistCreateParams(
  name: string,
  userId: string,
  itemIds: string[]
): URLSearchParams {
  const params = new URLSearchParams({
    Name: name,
    UserId: userId,
    MediaType: 'Video',
  })

  if (itemIds.length > 0) {
    params.set('Ids', itemIds.join(','))
  }

  return params
}

export function buildCollectionCreateParams(name: string, itemIds: string[]): URLSearchParams {
  const params = new URLSearchParams({ Name: name })

  if (itemIds.length > 0) {
    params.set('Ids', itemIds.join(','))
  }

  return params
}

export function playlistItemsPath(playlistId: string): string {
  return `/Playlists/${playlistId}/Items`
}

export function playlistAddItemsPath(playlistId: string, itemIds: string[]): string {
  return `${playlistItemsPath(playlistId)}?Ids=${itemIds.join(',')}`
}

export function playlistRemoveItemsPath(playlistId: string, entryIds: string[]): string {
  return `${playlistItemsPath(playlistId)}?EntryIds=${entryIds.join(',')}`
}

export function collectionItemsPath(collectionId: string, itemIds: string[]): string {
  return `/Collections/${collectionId}/Items?Ids=${itemIds.join(',')}`
}

export function collectionChildItemsQuery(collectionId: string): string {
  return `/Items?ParentId=${collectionId}&Recursive=true`
}
