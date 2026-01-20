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
  maxParentalRating?: number // NULL means unrestricted
  email?: string // Email from Emby Connect or user configuration
}

export interface Library {
  id: string // ItemId - for Items API (/Items/...)
  virtualFolderId?: string // VirtualFolder Id - for library options API
  guid: string // Used for user permissions in Emby/Jellyfin
  name: string
  collectionType: string
  path?: string
  refreshStatus?: string
}

export interface PlaylistItem {
  id: string
  playlistItemId: string // The entry ID within the playlist (for removal)
  title: string
  year: number | null
  posterUrl: string | null
  runtime: number | null // in minutes
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
  /** Production studios with IDs for image lookups */
  studios?: Array<{ id?: string; name: string; imageTag?: string }>
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

export interface WatchedEpisode {
  episodeId: string
  seriesId: string
  playCount: number
  isFavorite: boolean
  lastPlayedDate?: string
  userRating?: number
}

export interface Series {
  id: string
  name: string
  originalTitle?: string
  sortName?: string
  year?: number // First air year
  endYear?: number // Last air year (null if ongoing)
  premiereDate?: string
  genres: string[]
  overview?: string
  tagline?: string
  communityRating?: number
  criticRating?: number
  contentRating?: string // TV-MA, TV-14, etc.
  status?: string // 'Continuing', 'Ended'
  totalSeasons?: number
  totalEpisodes?: number
  airDays?: string[]
  network?: string
  posterImageTag?: string
  backdropImageTag?: string
  userData?: UserData
  /** The parent library ID this series belongs to */
  parentId?: string
  /** Production studios/networks with IDs for image lookups */
  studios?: Array<{ id?: string; name: string; imageTag?: string }>
  /** Series creators/showrunners */
  directors?: string[]
  /** Writers */
  writers?: string[]
  /** Cast with name, role, and thumbnail */
  actors?: Array<{ name: string; role?: string; thumb?: string }>
  /** External IDs */
  imdbId?: string
  tmdbId?: string
  tvdbId?: string
  /** User-defined tags */
  tags?: string[]
  /** Production countries */
  productionCountries?: string[]
  /** Awards text */
  awards?: string
}

export interface Episode {
  id: string
  seriesId: string
  seriesName: string
  seasonNumber: number
  episodeNumber: number
  name: string
  overview?: string
  premiereDate?: string
  year?: number
  runtimeTicks?: number
  communityRating?: number
  posterImageTag?: string
  userData?: UserData
  path?: string
  mediaSources?: MediaSource[]
  /** Episode director(s) */
  directors?: string[]
  /** Episode writer(s) */
  writers?: string[]
  /** Guest stars */
  guestStars?: Array<{ name: string; role?: string; thumb?: string }>
}

export interface PlaylistCreateResult {
  playlistId: string
}

export interface CollectionCreateResult {
  collectionId: string
}

export interface LibraryCreateResult {
  libraryId: string
  alreadyExists?: boolean
}


/**
 * Resume item from Emby/Jellyfin Resume API
 * Represents an item that is partially watched (in progress)
 */
export interface ResumeItem {
  id: string
  name: string
  type: 'Movie' | 'Episode'
  parentId: string  // Library ID
  parentName?: string  // Library name
  year?: number
  // Episode-specific fields
  seriesId?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  // External IDs for deduplication
  tmdbId?: string
  imdbId?: string
  // Progress info
  playbackPositionTicks: number
  runTimeTicks: number
  progressPercent: number
  userData: UserData
  // Media path for STRM/symlink creation
  path?: string
}
