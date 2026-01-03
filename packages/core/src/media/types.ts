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
  guid: string // Used for user permissions in Emby/Jellyfin
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
  sortName?: string
  year?: number
  premiereDate?: string
  genres: string[]
  overview?: string
  tagline?: string
  communityRating?: number
  criticRating?: number
  contentRating?: string // MPAA rating (PG-13, R, etc.)
  runtimeTicks?: number
  path?: string
  mediaSources?: MediaSource[]
  posterImageTag?: string
  backdropImageTag?: string
  userData?: UserData
  /** The parent library ID this movie belongs to */
  parentId?: string
  /** Production studios */
  studios?: string[]
  /** Director names */
  directors?: string[]
  /** Writer names */
  writers?: string[]
  /** Cast with name, role, and thumbnail */
  actors?: Array<{ name: string; role?: string; thumb?: string }>
  /** External IDs */
  imdbId?: string
  tmdbId?: string
  /** User-defined tags */
  tags?: string[]
  /** Production countries */
  productionCountries?: string[]
  /** Awards text */
  awards?: string
  /** Video quality info */
  videoResolution?: string
  videoCodec?: string
  audioCodec?: string
  container?: string
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

