import type {
  AuthResult,
  MediaServerUser,
  Library,
  PaginationOptions,
  PaginatedResult,
  Movie,
  WatchedItem,
  PlaylistCreateResult,
  LibraryCreateResult,
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
   */
  getWatchHistory(apiKey: string, userId: string): Promise<WatchedItem[]>

  /**
   * Get movie by ID
   */
  getMovieById(apiKey: string, movieId: string): Promise<Movie | null>

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
}
