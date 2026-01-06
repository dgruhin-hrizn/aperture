import type {
  AuthResult,
  MediaServerUser,
  Library,
  PaginationOptions,
  PaginatedResult,
  Movie,
  Series,
  Episode,
  WatchedItem,
  WatchedEpisode,
  PlaylistCreateResult,
  CollectionCreateResult,
  LibraryCreateResult,
  PlaylistItem,
} from './types.js'

/**
 * Abstract interface for media server providers (Emby/Jellyfin)
 */
export interface MediaServerProvider {
  /**
   * Provider type identifier
   */
  readonly type: 'emby' | 'jellyfin'

  /**
   * Base URL of the media server
   */
  readonly baseUrl: string

  // =========================================================================
  // Authentication
  // =========================================================================

  /**
   * Authenticate a user by username and password
   * Returns user info and access token for making API calls on their behalf
   */
  authenticateByName(username: string, password: string): Promise<AuthResult>

  // =========================================================================
  // Users
  // =========================================================================

  /**
   * Get all users from the media server
   * Requires admin API key
   */
  getUsers(apiKey: string): Promise<MediaServerUser[]>

  /**
   * Get a specific user by ID
   * Requires admin API key
   */
  getUserById(apiKey: string, userId: string): Promise<MediaServerUser>

  // =========================================================================
  // Libraries
  // =========================================================================

  /**
   * Get all libraries from the media server
   */
  getLibraries(apiKey: string): Promise<Library[]>

  /**
   * Get only movie libraries from the media server
   * Convenience method that filters getLibraries() to 'movies' collection type
   */
  getMovieLibraries(apiKey: string): Promise<Library[]>

  /**
   * Create a virtual library pointing to a directory
   * Used for STRM-based recommendation libraries
   */
  createVirtualLibrary(
    apiKey: string,
    name: string,
    path: string,
    collectionType: 'movies' | 'tvshows'
  ): Promise<LibraryCreateResult>

  /**
   * Get user's current library access settings
   */
  getUserLibraryAccess(
    apiKey: string,
    userId: string
  ): Promise<{ enableAllFolders: boolean; enabledFolders: string[] }>

  /**
   * Update user's library access permissions
   * Controls which libraries a user can see (uses GUIDs)
   */
  updateUserLibraryAccess(
    apiKey: string,
    userId: string,
    allowedLibraryGuids: string[]
  ): Promise<void>

  /**
   * Trigger a library refresh/scan
   */
  refreshLibrary(apiKey: string, libraryId: string): Promise<void>

  // =========================================================================
  // Items (Movies)
  // =========================================================================

  /**
   * Get all movies from the media server
   * Supports pagination for large libraries
   */
  getMovies(apiKey: string, options?: PaginationOptions): Promise<PaginatedResult<Movie>>

  /**
   * Get a user's watch history for movies
   * Returns played items with watch data
   * @param sinceDate - If provided, only return items played since this date (delta sync)
   */
  getWatchHistory(apiKey: string, userId: string, sinceDate?: Date): Promise<WatchedItem[]>

  /**
   * Get movie by ID
   */
  getMovieById(apiKey: string, movieId: string): Promise<Movie | null>

  // =========================================================================
  // Items (TV Series)
  // =========================================================================

  /**
   * Get only TV show libraries from the media server
   * Convenience method that filters getLibraries() to 'tvshows' collection type
   */
  getTvShowLibraries(apiKey: string): Promise<Library[]>

  /**
   * Get all TV series from the media server
   * Supports pagination for large libraries
   */
  getSeries(apiKey: string, options?: PaginationOptions): Promise<PaginatedResult<Series>>

  /**
   * Get series by ID
   */
  getSeriesById(apiKey: string, seriesId: string): Promise<Series | null>

  /**
   * Get all episodes from the media server
   * Can optionally filter by series ID
   * Supports pagination for large libraries
   */
  getEpisodes(
    apiKey: string,
    options?: PaginationOptions & { seriesId?: string }
  ): Promise<PaginatedResult<Episode>>

  /**
   * Get episode by ID
   */
  getEpisodeById(apiKey: string, episodeId: string): Promise<Episode | null>

  /**
   * Get a user's watch history for TV series/episodes
   * Returns played episodes with watch data
   * @param sinceDate - If provided, only return items played since this date (delta sync)
   */
  getSeriesWatchHistory(apiKey: string, userId: string, sinceDate?: Date): Promise<WatchedEpisode[]>

  // =========================================================================
  // Playlists
  // =========================================================================

  /**
   * Create or update a playlist
   * If playlist exists, updates its contents; otherwise creates new
   */
  createOrUpdatePlaylist(
    apiKey: string,
    userId: string,
    name: string,
    itemIds: string[]
  ): Promise<PlaylistCreateResult>

  /**
   * Delete a playlist
   */
  deletePlaylist(apiKey: string, playlistId: string): Promise<void>

  /**
   * Get items in a playlist
   */
  getPlaylistItems(apiKey: string, playlistId: string): Promise<PlaylistItem[]>

  /**
   * Remove items from a playlist
   */
  removePlaylistItems(apiKey: string, playlistId: string, itemIds: string[]): Promise<void>

  /**
   * Add items to a playlist
   */
  addPlaylistItems(apiKey: string, playlistId: string, itemIds: string[]): Promise<void>

  // =========================================================================
  // Collections (Box Sets)
  // =========================================================================

  /**
   * Create or update a collection (Box Set)
   * Collections group items within libraries and appear in the browse view
   * Unlike playlists, collections are not ordered
   */
  createOrUpdateCollection(
    apiKey: string,
    name: string,
    itemIds: string[]
  ): Promise<CollectionCreateResult>

  /**
   * Delete a collection
   */
  deleteCollection(apiKey: string, collectionId: string): Promise<void>

  /**
   * Get items in a collection
   */
  getCollectionItems(apiKey: string, collectionId: string): Promise<string[]>

  /**
   * Add items to a collection
   */
  addCollectionItems(apiKey: string, collectionId: string, itemIds: string[]): Promise<void>

  /**
   * Remove items from a collection
   */
  removeCollectionItems(apiKey: string, collectionId: string, itemIds: string[]): Promise<void>

  // =========================================================================
  // Genres
  // =========================================================================

  /**
   * Get all available genres from the media server
   * Returns unique genre names sorted alphabetically
   */
  getGenres(apiKey: string): Promise<string[]>

  // =========================================================================
  // Utilities
  // =========================================================================

  /**
   * Build URL for a poster image
   */
  getPosterUrl(itemId: string, imageTag?: string): string

  /**
   * Build URL for a backdrop image
   */
  getBackdropUrl(itemId: string, imageTag?: string): string

  /**
   * Build streaming URL for an item
   */
  getStreamUrl(apiKey: string, itemId: string): string

  // =========================================================================
  // Watch History Management
  // =========================================================================

  /**
   * Mark a movie as unwatched/unplayed
   */
  markMovieUnplayed(apiKey: string, userId: string, movieId: string): Promise<void>

  /**
   * Mark an episode as unwatched/unplayed
   */
  markEpisodeUnplayed(apiKey: string, userId: string, episodeId: string): Promise<void>

  /**
   * Mark all episodes in a season as unwatched/unplayed
   * Returns the count of episodes marked
   */
  markSeasonUnplayed(
    apiKey: string,
    userId: string,
    seriesId: string,
    seasonNumber: number
  ): Promise<{ markedCount: number }>

  /**
   * Mark all episodes in a series as unwatched/unplayed
   * Returns the count of episodes marked
   */
  markSeriesUnplayed(
    apiKey: string,
    userId: string,
    seriesId: string
  ): Promise<{ markedCount: number }>
}
