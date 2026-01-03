import { createChildLogger } from '../lib/logger.js'
import type { MediaServerProvider } from './MediaServerProvider.js'
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

const logger = createChildLogger('emby-provider')

interface EmbyAuthResponse {
  User: {
    Id: string
    Name: string
    ServerId: string
    Policy: {
      IsAdministrator: boolean
    }
  }
  AccessToken: string
}

interface EmbyUser {
  Id: string
  Name: string
  ServerId: string
  Policy: {
    IsAdministrator: boolean
    IsDisabled: boolean
    EnableAllFolders?: boolean
    EnabledFolders?: string[]
  }
  LastActivityDate?: string
  PrimaryImageTag?: string
}

interface EmbyLibrary {
  Id?: string
  ItemId?: string
  Guid?: string
  Name: string
  CollectionType: string
  Path?: string
  RefreshStatus?: string
}

interface EmbyItem {
  Id: string
  Name: string
  OriginalTitle?: string
  ProductionYear?: number
  Genres?: string[]
  Overview?: string
  CommunityRating?: number
  CriticRating?: number
  RunTimeTicks?: number
  Path?: string
  ParentId?: string
  MediaSources?: Array<{
    Id: string
    Path: string
    Container: string
    Size?: number
    Bitrate?: number
  }>
  ImageTags?: {
    Primary?: string
    Backdrop?: string
  }
  BackdropImageTags?: string[]
  UserData?: {
    PlayCount: number
    IsFavorite: boolean
    LastPlayedDate?: string
    PlaybackPositionTicks?: number
    Played: boolean
  }
}

interface EmbyItemsResponse {
  Items: EmbyItem[]
  TotalRecordCount: number
  StartIndex: number
}

interface EmbyActivityEntry {
  Id: number
  Name: string
  Type: string
  ItemId?: string
  Date: string
  UserId?: string
  Severity: string
}

interface EmbyActivityResponse {
  Items: EmbyActivityEntry[]
  TotalRecordCount: number
}

export class EmbyProvider implements MediaServerProvider {
  readonly type = 'emby' as const
  readonly baseUrl: string
  private readonly clientName = 'Aperture'
  private readonly deviceId = 'aperture-server'
  private readonly deviceName = 'Aperture Server'
  private readonly clientVersion = '1.0.0'

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  private getAuthHeader(apiKey: string): string {
    return `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}", Token="${apiKey}"`
  }

  private async fetch<T>(
    endpoint: string,
    apiKey: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'X-Emby-Authorization': this.getAuthHeader(apiKey),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    logger.debug({ method: options.method || 'GET', url }, '📡 Emby API Request')

    const startTime = Date.now()
    const response = await fetch(url, {
      ...options,
      headers,
    })
    const duration = Date.now() - startTime

    if (!response.ok) {
      const text = await response.text()
      logger.error(
        { status: response.status, url, body: text, duration },
        '❌ Emby API error'
      )
      throw new Error(`Emby API error: ${response.status} ${response.statusText}`)
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      logger.debug({ url, duration, empty: true }, '✅ Emby API Response (empty)')
      return {} as T
    }

    const data = JSON.parse(text) as T

    // Log response summary
    logger.debug(
      {
        url,
        duration,
        responseSize: text.length,
        // If it's an items response, log count
        ...(typeof data === 'object' && data !== null && 'Items' in data
          ? {
              itemCount: (data as { Items?: unknown[] }).Items?.length,
              totalRecordCount: (data as { TotalRecordCount?: number }).TotalRecordCount,
            }
          : {}),
      },
      '✅ Emby API Response'
    )

    return data
  }

  /**
   * Get system/server information including ServerId
   */
  async getServerInfo(apiKey: string): Promise<{ id: string; name: string; version: string }> {
    interface SystemInfoResponse {
      Id: string
      ServerName: string
      Version: string
      LocalAddress: string
      WanAddress?: string
    }

    const data = await this.fetch<SystemInfoResponse>('/System/Info', apiKey)
    return {
      id: data.Id,
      name: data.ServerName,
      version: data.Version,
    }
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  async authenticateByName(username: string, password: string): Promise<AuthResult> {
    const url = `${this.baseUrl}/Users/AuthenticateByName`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Emby-Authorization': `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}"`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Username: username,
        Pw: password,
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid username or password')
      }
      throw new Error(`Authentication failed: ${response.status}`)
    }

    const data = (await response.json()) as EmbyAuthResponse

    return {
      userId: data.User.Id,
      accessToken: data.AccessToken,
      userName: data.User.Name,
      isAdmin: data.User.Policy.IsAdministrator,
      serverId: data.User.ServerId,
    }
  }

  // =========================================================================
  // Users
  // =========================================================================

  async getUsers(apiKey: string): Promise<MediaServerUser[]> {
    const users = await this.fetch<EmbyUser[]>('/Users', apiKey)

    return users.map((user) => ({
      id: user.Id,
      name: user.Name,
      serverId: user.ServerId,
      isAdmin: user.Policy.IsAdministrator,
      isDisabled: user.Policy.IsDisabled,
      lastActivityDate: user.LastActivityDate,
      primaryImageTag: user.PrimaryImageTag,
    }))
  }

  async getUserById(apiKey: string, userId: string): Promise<MediaServerUser> {
    const user = await this.fetch<EmbyUser>(`/Users/${userId}`, apiKey)

    return {
      id: user.Id,
      name: user.Name,
      serverId: user.ServerId,
      isAdmin: user.Policy.IsAdministrator,
      isDisabled: user.Policy.IsDisabled,
      lastActivityDate: user.LastActivityDate,
      primaryImageTag: user.PrimaryImageTag,
    }
  }

  // =========================================================================
  // Libraries
  // =========================================================================

  async getLibraries(apiKey: string): Promise<Library[]> {
    // Emby returns an array directly, not { Items: [...] }
    const response = await this.fetch<EmbyLibrary[]>(
      '/Library/VirtualFolders',
      apiKey
    )

    // Handle both array response and object with Items property
    const libraries = Array.isArray(response) ? response : (response as any).Items || []

    return libraries.map((lib: EmbyLibrary) => ({
      id: lib.ItemId || lib.Id || '',
      guid: lib.Guid || lib.ItemId || lib.Id || '', // GUID is used for user permissions
      name: lib.Name,
      collectionType: lib.CollectionType,
      path: lib.Path,
      refreshStatus: lib.RefreshStatus,
    }))
  }

  async getMovieLibraries(apiKey: string): Promise<Library[]> {
    const libraries = await this.getLibraries(apiKey)
    return libraries.filter((lib) => lib.collectionType === 'movies')
  }

  async createVirtualLibrary(
    apiKey: string,
    name: string,
    path: string,
    collectionType: 'movies' | 'tvshows'
  ): Promise<LibraryCreateResult> {
    // Emby uses different collection type names
    const embyCollectionType = collectionType === 'movies' ? 'movies' : 'tvshows'

    await this.fetch(
      `/Library/VirtualFolders?name=${encodeURIComponent(name)}&collectionType=${embyCollectionType}&paths=${encodeURIComponent(path)}&refreshLibrary=true`,
      apiKey,
      { method: 'POST' }
    )

    // Get the created library to find its ID
    const libraries = await this.getLibraries(apiKey)
    const created = libraries.find((lib) => lib.name === name)

    if (!created) {
      throw new Error(`Failed to find created library: ${name}`)
    }

    return { libraryId: created.id }
  }

  async getUserLibraryAccess(
    apiKey: string,
    userId: string
  ): Promise<{ enableAllFolders: boolean; enabledFolders: string[] }> {
    const user = await this.fetch<EmbyUser>(`/Users/${userId}`, apiKey)
    return {
      enableAllFolders: user.Policy?.EnableAllFolders ?? true,
      enabledFolders: user.Policy?.EnabledFolders ?? [],
    }
  }

  async updateUserLibraryAccess(
    apiKey: string,
    userId: string,
    allowedLibraryGuids: string[]
  ): Promise<void> {
    // Get current user policy
    const user = await this.fetch<EmbyUser>(`/Users/${userId}`, apiKey)

    // Update the policy with new library access (using GUIDs)
    await this.fetch(`/Users/${userId}/Policy`, apiKey, {
      method: 'POST',
      body: JSON.stringify({
        ...user.Policy,
        EnableAllFolders: false,
        EnabledFolders: allowedLibraryGuids,
      }),
    })
  }

  async refreshLibrary(apiKey: string, libraryId: string): Promise<void> {
    await this.fetch(`/Items/${libraryId}/Refresh`, apiKey, { method: 'POST' })
  }

  // =========================================================================
  // Items (Movies)
  // =========================================================================

  async getMovies(
    apiKey: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Movie>> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      Fields: 'Overview,Genres,ProductionYear,CommunityRating,CriticRating,Path,MediaSources,OriginalTitle,ParentId',
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

    const response = await this.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)

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
              Overview: firstItem.Overview?.substring(0, 100) + (firstItem.Overview && firstItem.Overview.length > 100 ? '...' : ''),
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
      items: response.Items.map((item) => this.mapMovie(item)),
      totalRecordCount: response.TotalRecordCount,
      startIndex: response.StartIndex,
    }
  }

  async getWatchHistory(apiKey: string, userId: string): Promise<WatchedItem[]> {
    logger.info({ userId }, 'Fetching watch history from Emby')

    // Use Items API with full UserData fields - this gets ALL watched items with proper data
    // The key is adding UserDataPlayCount,UserDataLastPlayedDate to the Fields parameter
    return this.getWatchHistoryFromItems(apiKey, userId)
  }

  /**
   * Alternative method using Activity Log (useful for getting very recent playback data)
   * This is kept for reference but getWatchHistoryFromItems now works correctly
   */
  async getWatchHistoryFromActivityLog(apiKey: string, userId: string): Promise<WatchedItem[]> {
    logger.info({ userId }, 'Fetching watch history using Activity Log')

    // First, get the user's display name (needed to match Activity Log entries)
    const users = await this.getUsers(apiKey)
    const user = users.find((u) => u.id === userId)
    if (!user) {
      logger.warn({ userId }, 'User not found for Activity Log method')
      return []
    }

    const username = user.name
    logger.debug({ userId, username }, 'Found user, fetching Activity Log')

    // Get recent playback from Activity Log (last 10000 entries should be plenty)
    const activityResponse = await this.fetch<EmbyActivityResponse>(
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

    logger.info({ userId, username, playbackEvents: userPlaybackEvents.length }, 'Found playback events in Activity Log')

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
    const favoritesResponse = await this.fetch<EmbyItemsResponse>(
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

  /**
   * Get watch history from Items API with full UserData fields
   * This returns ALL watched items with proper PlayCount and LastPlayedDate,
   * PLUS any unwatched favorites (so favorites count is accurate)
   */
  private async getWatchHistoryFromItems(apiKey: string, userId: string): Promise<WatchedItem[]> {
    logger.info({ userId }, 'Fetching watch history from Items API with full UserData')
    
    const itemsMap = new Map<string, WatchedItem>()
    
    // Step 1: Fetch all PLAYED movies
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

      const response = await this.fetch<EmbyItemsResponse>(`/Users/${userId}/Items?${params}`, apiKey)

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
    
    const favoritesResponse = await this.fetch<EmbyItemsResponse>(
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
      { userId, totalFavorites: favoritesResponse.Items.length, addedUnwatchedFavorites: addedFavorites },
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

  async getMovieById(apiKey: string, movieId: string): Promise<Movie | null> {
    try {
      const item = await this.fetch<EmbyItem>(
        `/Items/${movieId}?Fields=Overview,Genres,CommunityRating,CriticRating,Path,MediaSources`,
        apiKey
      )
      return this.mapMovie(item)
    } catch {
      return null
    }
  }

  private mapMovie(item: EmbyItem): Movie {
    return {
      id: item.Id,
      name: item.Name,
      originalTitle: item.OriginalTitle,
      year: item.ProductionYear,
      genres: item.Genres || [],
      overview: item.Overview,
      communityRating: item.CommunityRating,
      criticRating: item.CriticRating,
      runtimeTicks: item.RunTimeTicks,
      path: item.Path,
      mediaSources: item.MediaSources?.map((ms) => ({
        id: ms.Id,
        path: ms.Path,
        container: ms.Container,
        size: ms.Size,
        bitrate: ms.Bitrate,
      })),
      posterImageTag: item.ImageTags?.Primary,
      backdropImageTag: item.BackdropImageTags?.[0] || item.ImageTags?.Backdrop,
      parentId: item.ParentId,
      userData: item.UserData
        ? {
            playCount: item.UserData.PlayCount,
            isFavorite: item.UserData.IsFavorite,
            lastPlayedDate: item.UserData.LastPlayedDate,
            playbackPositionTicks: item.UserData.PlaybackPositionTicks,
            played: item.UserData.Played,
          }
        : undefined,
    }
  }

  // =========================================================================
  // Playlists
  // =========================================================================

  async createOrUpdatePlaylist(
    apiKey: string,
    userId: string,
    name: string,
    itemIds: string[]
  ): Promise<PlaylistCreateResult> {
    // First, try to find existing playlist
    const params = new URLSearchParams({
      IncludeItemTypes: 'Playlist',
      Recursive: 'true',
      SearchTerm: name,
      UserId: userId,
    })

    const existing = await this.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)
    const playlist = existing.Items.find((p) => p.Name === name)

    if (playlist) {
      // Clear existing items and add new ones
      await this.fetch(`/Playlists/${playlist.Id}/Items`, apiKey, { method: 'DELETE' })

      if (itemIds.length > 0) {
        await this.fetch(
          `/Playlists/${playlist.Id}/Items?Ids=${itemIds.join(',')}`,
          apiKey,
          { method: 'POST' }
        )
      }

      return { playlistId: playlist.Id }
    }

    // Create new playlist
    const createParams = new URLSearchParams({
      Name: name,
      UserId: userId,
      MediaType: 'Video',
    })

    if (itemIds.length > 0) {
      createParams.set('Ids', itemIds.join(','))
    }

    const created = await this.fetch<{ Id: string }>(
      `/Playlists?${createParams}`,
      apiKey,
      { method: 'POST' }
    )

    return { playlistId: created.Id }
  }

  async deletePlaylist(apiKey: string, playlistId: string): Promise<void> {
    await this.fetch(`/Items/${playlistId}`, apiKey, { method: 'DELETE' })
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  getPosterUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Primary${params}`
  }

  getBackdropUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Backdrop${params}`
  }

  getStreamUrl(apiKey: string, itemId: string): string {
    return `${this.baseUrl}/Videos/${itemId}/stream?api_key=${apiKey}`
  }
}

