import { createChildLogger } from '../lib/logger.js'
import type { MediaServerProvider } from './MediaServerProvider.js'
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
  LibraryCreateResult,
  PlaylistItem,
} from './types.js'

const logger = createChildLogger('jellyfin-provider')

interface JellyfinAuthResponse {
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

interface JellyfinUser {
  Id: string
  Name: string
  ServerId: string
  Policy: {
    IsAdministrator: boolean
    IsDisabled: boolean
    EnableAllFolders?: boolean
    EnabledFolders?: string[]
    MaxParentalRating?: number
  }
  LastActivityDate?: string
  PrimaryImageTag?: string
}

interface JellyfinLibrary {
  Id: string
  Guid?: string
  Name: string
  CollectionType: string
  Path?: string
  RefreshStatus?: string
}

interface JellyfinItem {
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

interface JellyfinItemsResponse {
  Items: JellyfinItem[]
  TotalRecordCount: number
  StartIndex: number
}

export class JellyfinProvider implements MediaServerProvider {
  readonly type = 'jellyfin' as const
  readonly baseUrl: string
  private readonly clientName = 'Aperture'
  private readonly deviceId = 'aperture-server'
  private readonly deviceName = 'Aperture Server'
  private readonly clientVersion = '1.0.0'

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  private getAuthHeader(apiKey?: string): string {
    let header = `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}"`
    if (apiKey) {
      header += `, Token="${apiKey}"`
    }
    return header
  }

  private async fetch<T>(
    endpoint: string,
    apiKey: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(apiKey),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error({ status: response.status, url, body: text }, 'Jellyfin API error')
      throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`)
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  async authenticateByName(username: string, password: string): Promise<AuthResult> {
    const url = `${this.baseUrl}/Users/AuthenticateByName`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
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

    const data = (await response.json()) as JellyfinAuthResponse

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
    const users = await this.fetch<JellyfinUser[]>('/Users', apiKey)

    return users.map((user) => ({
      id: user.Id,
      name: user.Name,
      serverId: user.ServerId,
      isAdmin: user.Policy.IsAdministrator,
      isDisabled: user.Policy.IsDisabled,
      lastActivityDate: user.LastActivityDate,
      primaryImageTag: user.PrimaryImageTag,
      maxParentalRating: user.Policy.MaxParentalRating,
    }))
  }

  async getUserById(apiKey: string, userId: string): Promise<MediaServerUser> {
    const user = await this.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)

    return {
      id: user.Id,
      name: user.Name,
      serverId: user.ServerId,
      isAdmin: user.Policy.IsAdministrator,
      isDisabled: user.Policy.IsDisabled,
      lastActivityDate: user.LastActivityDate,
      primaryImageTag: user.PrimaryImageTag,
      maxParentalRating: user.Policy.MaxParentalRating,
    }
  }

  // =========================================================================
  // Libraries
  // =========================================================================

  async getLibraries(apiKey: string): Promise<Library[]> {
    // Jellyfin may return an array directly
    const response = await this.fetch<JellyfinLibrary[]>(
      '/Library/VirtualFolders',
      apiKey
    )

    // Handle both array response and object with Items property
    const libraries = Array.isArray(response) ? response : (response as any).Items || []

    return libraries.map((lib: JellyfinLibrary) => ({
      id: lib.Id,
      guid: lib.Guid || lib.Id, // Jellyfin may use Id for permissions
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
    // Jellyfin uses the same collection type names as our interface
    await this.fetch(
      `/Library/VirtualFolders?name=${encodeURIComponent(name)}&collectionType=${collectionType}&paths=${encodeURIComponent(path)}&refreshLibrary=true`,
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
    const user = await this.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)
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
    const user = await this.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)

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

    const response = await this.fetch<JellyfinItemsResponse>(`/Items?${params}`, apiKey)

    return {
      items: response.Items.map((item) => this.mapMovie(item)),
      totalRecordCount: response.TotalRecordCount,
      startIndex: response.StartIndex,
    }
  }

  async getWatchHistory(apiKey: string, userId: string): Promise<WatchedItem[]> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      Fields: 'UserData',
      IsPlayed: 'true',
    })

    const response = await this.fetch<JellyfinItemsResponse>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )

    return response.Items.filter((item) => item.UserData?.Played).map((item) => ({
      movieId: item.Id,
      playCount: item.UserData?.PlayCount || 0,
      isFavorite: item.UserData?.IsFavorite || false,
      lastPlayedDate: item.UserData?.LastPlayedDate,
    }))
  }

  async getMovieById(apiKey: string, movieId: string): Promise<Movie | null> {
    try {
      const item = await this.fetch<JellyfinItem>(
        `/Items/${movieId}?Fields=Overview,Genres,CommunityRating,CriticRating,Path,MediaSources`,
        apiKey
      )
      return this.mapMovie(item)
    } catch {
      return null
    }
  }

  // =========================================================================
  // Items (TV Series) - TODO: Full implementation
  // =========================================================================

  async getTvShowLibraries(apiKey: string): Promise<Library[]> {
    const libraries = await this.getLibraries(apiKey)
    return libraries.filter((lib) => lib.collectionType === 'tvshows')
  }

  async getSeries(
    apiKey: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Series>> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Series',
      Recursive: 'true',
      Fields: 'Overview,Genres,ProductionYear,CommunityRating,Studios,People,ProviderIds,Tags,Status',
      StartIndex: String(options.startIndex || 0),
      Limit: String(options.limit || 100),
      SortBy: options.sortBy || 'SortName',
      SortOrder: options.sortOrder || 'Ascending',
    })

    if (options.parentIds && options.parentIds.length > 0) {
      params.set('ParentId', options.parentIds.join(','))
    }

    const response = await this.fetch<{ Items: any[]; TotalRecordCount: number; StartIndex: number }>(
      `/Items?${params}`,
      apiKey
    )

    return {
      items: response.Items.map((item) => this.mapSeries(item)),
      totalRecordCount: response.TotalRecordCount,
      startIndex: response.StartIndex,
    }
  }

  async getSeriesById(apiKey: string, seriesId: string): Promise<Series | null> {
    try {
      const item = await this.fetch<any>(
        `/Items/${seriesId}?Fields=Overview,Genres,CommunityRating,Studios,People,ProviderIds,Tags,Status`,
        apiKey
      )
      return this.mapSeries(item)
    } catch {
      return null
    }
  }

  async getEpisodes(
    apiKey: string,
    options: PaginationOptions & { seriesId?: string } = {}
  ): Promise<PaginatedResult<Episode>> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'Overview,ProductionYear,CommunityRating,Path,MediaSources,People,SeriesName',
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

    const response = await this.fetch<{ Items: any[]; TotalRecordCount: number; StartIndex: number }>(
      `/Items?${params}`,
      apiKey
    )

    return {
      items: response.Items.map((item) => this.mapEpisode(item)),
      totalRecordCount: response.TotalRecordCount,
      startIndex: response.StartIndex,
    }
  }

  async getEpisodeById(apiKey: string, episodeId: string): Promise<Episode | null> {
    try {
      const item = await this.fetch<any>(
        `/Items/${episodeId}?Fields=Overview,CommunityRating,Path,MediaSources,People,SeriesName`,
        apiKey
      )
      return this.mapEpisode(item)
    } catch {
      return null
    }
  }

  async getSeriesWatchHistory(apiKey: string, userId: string): Promise<WatchedEpisode[]> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Episode',
      Recursive: 'true',
      Fields: 'UserData,SeriesId',
      IsPlayed: 'true',
    })

    const response = await this.fetch<{ Items: any[] }>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )

    return response.Items
      .filter((item) => item.UserData?.Played)
      .map((item) => ({
        episodeId: item.Id,
        seriesId: item.SeriesId,
        playCount: item.UserData?.PlayCount || 0,
        isFavorite: item.UserData?.IsFavorite || false,
        lastPlayedDate: item.UserData?.LastPlayedDate,
      }))
  }

  private mapSeries(item: any): Series {
    const directors = item.People?.filter((p: any) => p.Type === 'Director' || p.Type === 'Creator').map((p: any) => p.Name) || []
    const writers = item.People?.filter((p: any) => p.Type === 'Writer').map((p: any) => p.Name) || []
    const actors = item.People?.filter((p: any) => p.Type === 'Actor').slice(0, 20).map((p: any) => ({
      name: p.Name,
      role: p.Role,
      thumb: p.PrimaryImageTag ? `${this.baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}` : undefined,
    })) || []

    return {
      id: item.Id,
      name: item.Name,
      originalTitle: item.OriginalTitle,
      sortName: item.SortName,
      year: item.ProductionYear,
      endYear: item.EndDate ? new Date(item.EndDate).getFullYear() : undefined,
      premiereDate: item.PremiereDate,
      genres: item.Genres || [],
      overview: item.Overview,
      tagline: item.Tagline,
      communityRating: item.CommunityRating,
      criticRating: item.CriticRating,
      contentRating: item.OfficialRating,
      status: item.Status,
      totalSeasons: item.ChildCount,
      totalEpisodes: item.RecursiveItemCount,
      airDays: item.AirDays,
      network: item.Studios?.[0]?.Name,
      posterImageTag: item.ImageTags?.Primary,
      backdropImageTag: item.BackdropImageTags?.[0] || item.ImageTags?.Backdrop,
      parentId: item.ParentId,
      studios: item.Studios?.map((s: any) => s.Name) || [],
      directors,
      writers,
      actors,
      imdbId: item.ProviderIds?.Imdb,
      tmdbId: item.ProviderIds?.Tmdb,
      tvdbId: item.ProviderIds?.Tvdb,
      tags: item.Tags || [],
      productionCountries: item.ProductionLocations || [],
      awards: item.Awards,
    }
  }

  private mapEpisode(item: any): Episode {
    const directors = item.People?.filter((p: any) => p.Type === 'Director').map((p: any) => p.Name) || []
    const writers = item.People?.filter((p: any) => p.Type === 'Writer').map((p: any) => p.Name) || []
    const guestStars = item.People?.filter((p: any) => p.Type === 'GuestStar').slice(0, 10).map((p: any) => ({
      name: p.Name,
      role: p.Role,
      thumb: p.PrimaryImageTag ? `${this.baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}` : undefined,
    })) || []

    return {
      id: item.Id,
      seriesId: item.SeriesId,
      seriesName: item.SeriesName,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber,
      name: item.Name,
      overview: item.Overview,
      premiereDate: item.PremiereDate,
      year: item.ProductionYear,
      runtimeTicks: item.RunTimeTicks,
      communityRating: item.CommunityRating,
      posterImageTag: item.ImageTags?.Primary,
      path: item.Path,
      mediaSources: item.MediaSources?.map((ms: any) => ({
        id: ms.Id,
        path: ms.Path,
        container: ms.Container,
        size: ms.Size,
        bitrate: ms.Bitrate,
      })),
      directors,
      writers,
      guestStars,
    }
  }

  private mapMovie(item: JellyfinItem): Movie {
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
    })

    const existing = await this.fetch<JellyfinItemsResponse>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )
    const playlist = existing.Items.find((p) => p.Name === name)

    if (playlist) {
      // In Jellyfin, we need to get playlist items and remove them first
      const playlistItems = await this.fetch<JellyfinItemsResponse>(
        `/Playlists/${playlist.Id}/Items`,
        apiKey
      )

      // Remove all existing items
      if (playlistItems.Items.length > 0) {
        const entryIds = playlistItems.Items.map((i) => i.Id).join(',')
        await this.fetch(`/Playlists/${playlist.Id}/Items?EntryIds=${entryIds}`, apiKey, {
          method: 'DELETE',
        })
      }

      // Add new items
      if (itemIds.length > 0) {
        await this.fetch(`/Playlists/${playlist.Id}/Items?Ids=${itemIds.join(',')}`, apiKey, {
          method: 'POST',
        })
      }

      return { playlistId: playlist.Id }
    }

    // Create new playlist
    const createBody = {
      Name: name,
      UserId: userId,
      MediaType: 'Video',
      Ids: itemIds,
    }

    const created = await this.fetch<{ Id: string }>('/Playlists', apiKey, {
      method: 'POST',
      body: JSON.stringify(createBody),
    })

    return { playlistId: created.Id }
  }

  async deletePlaylist(apiKey: string, playlistId: string): Promise<void> {
    await this.fetch(`/Items/${playlistId}`, apiKey, { method: 'DELETE' })
  }

  async getPlaylistItems(apiKey: string, playlistId: string): Promise<PlaylistItem[]> {
    const response = await this.fetch<{
      Items: Array<{
        Id: string
        PlaylistItemId: string
        Name: string
        ProductionYear?: number
        ImageTags?: { Primary?: string }
        RunTimeTicks?: number
      }>
    }>(`/Playlists/${playlistId}/Items?Fields=ImageTags,ProductionYear,RunTimeTicks`, apiKey)

    return response.Items.map((item) => ({
      id: item.Id,
      playlistItemId: item.PlaylistItemId,
      title: item.Name,
      year: item.ProductionYear || null,
      posterUrl: item.ImageTags?.Primary
        ? `${this.baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
        : null,
      runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
    }))
  }

  async removePlaylistItems(apiKey: string, playlistId: string, entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return
    await this.fetch(`/Playlists/${playlistId}/Items?EntryIds=${entryIds.join(',')}`, apiKey, {
      method: 'DELETE',
    })
  }

  async addPlaylistItems(apiKey: string, playlistId: string, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return
    await this.fetch(`/Playlists/${playlistId}/Items?Ids=${itemIds.join(',')}`, apiKey, {
      method: 'POST',
    })
  }

  // =========================================================================
  // Genres
  // =========================================================================

  async getGenres(apiKey: string): Promise<string[]> {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
    })

    const response = await this.fetch<{ Items: Array<{ Name: string }> }>(
      `/Genres?${params}`,
      apiKey
    )

    return response.Items.map((item) => item.Name)
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

