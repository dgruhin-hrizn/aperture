/**
 * Media Server Provider Types
 */

export type MediaServerType = 'emby' | 'jellyfin'

export interface AuthResult {
  userId: string
  accessToken: string
  userName: string
  isAdmin: boolean
  serverId?: string
}

export interface MediaServerUser {
  id: string
  name: string
  serverId?: string
  isAdmin: boolean
  isDisabled: boolean
  lastActivityDate?: string
  primaryImageTag?: string
}

export interface Library {
  id: string
  name: string
  collectionType: string
  path?: string
  refreshStatus?: string
}

export interface PaginationOptions {
  startIndex?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'Ascending' | 'Descending'
  filters?: Record<string, string>
  /** Filter by parent library IDs (only return items from these libraries) */
  parentIds?: string[]
}

export interface PaginatedResult<T> {
  items: T[]
  totalRecordCount: number
  startIndex: number
}

export interface Movie {
  id: string
  name: string
  originalTitle?: string
  year?: number
  genres: string[]
  overview?: string
  communityRating?: number
  criticRating?: number
  runtimeTicks?: number
  path?: string
  mediaSources?: MediaSource[]
  posterImageTag?: string
  backdropImageTag?: string
  userData?: UserData
  /** The parent library ID this movie belongs to */
  parentId?: string
}

export interface MediaSource {
  id: string
  path: string
  container: string
  size?: number
  bitrate?: number
}

export interface UserData {
  playCount: number
  isFavorite: boolean
  lastPlayedDate?: string
  playbackPositionTicks?: number
  played: boolean
}

export interface WatchedItem {
  movieId: string
  playCount: number
  isFavorite: boolean
  lastPlayedDate?: string
  userRating?: number
}

export interface PlaylistCreateResult {
  playlistId: string
}

export interface LibraryCreateResult {
  libraryId: string
}

