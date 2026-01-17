export interface EmbyAuthResponse {
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

export interface EmbyUser {
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
  // Emby Connect email (if user has Emby Connect linked)
  ConnectUserName?: string
}

export interface EmbyLibrary {
  Id?: string
  ItemId?: string
  Guid?: string
  Name: string
  CollectionType: string
  Path?: string
  RefreshStatus?: string
  LibraryOptions?: Record<string, unknown> // Full library options object from Emby
}

export interface EmbyLibraryResponse {
  Items: EmbyLibrary[]
}

export interface EmbyItem {
  Id: string
  Name: string
  OriginalTitle?: string
  SortName?: string
  ProductionYear?: number
  PremiereDate?: string
  Genres?: string[]
  Overview?: string
  Tagline?: string
  CommunityRating?: number
  CriticRating?: number
  OfficialRating?: string // MPAA rating (PG-13, R, etc.)
  RunTimeTicks?: number
  Path?: string
  ParentId?: string
  Studios?: Array<{ Name: string; Id?: number | string }>
  People?: Array<{
    Name: string
    Id?: string
    Role?: string
    Type: string // Actor, Director, Writer, etc.
    PrimaryImageTag?: string
  }>
  ProviderIds?: {
    Imdb?: string
    Tmdb?: string
    [key: string]: string | undefined
  }
  Tags?: string[]
  ProductionLocations?: string[]
  Awards?: string
  MediaSources?: Array<{
    Id: string
    Path: string
    Container: string
    Size?: number
    Bitrate?: number
    MediaStreams?: Array<{
      Type: string // Video, Audio, Subtitle
      Codec?: string
      Width?: number
      Height?: number
      DisplayTitle?: string
    }>
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

export interface EmbyItemsResponse {
  Items: EmbyItem[]
  TotalRecordCount: number
  StartIndex: number
}

export interface EmbyActivityEntry {
  Id: number
  Name: string
  Type: string
  ItemId?: string
  Date: string
  UserId?: string
  Severity: string
}

export interface EmbyActivityResponse {
  Items: EmbyActivityEntry[]
  TotalRecordCount: number
}

export interface EmbySystemInfo {
  Id: string
  ServerName: string
  Version: string
  LocalAddress: string
  WanAddress?: string
}

export interface EmbySeries {
  Id: string
  Name: string
  OriginalTitle?: string
  SortName?: string
  ProductionYear?: number
  EndDate?: string
  PremiereDate?: string
  Genres?: string[]
  Overview?: string
  Tagline?: string
  CommunityRating?: number
  CriticRating?: number
  OfficialRating?: string
  Status?: string // 'Continuing', 'Ended'
  AirDays?: string[]
  Studios?: Array<{ Name: string; Id?: number | string }>
  People?: Array<{
    Name: string
    Id?: string
    Role?: string
    Type: string
    PrimaryImageTag?: string
  }>
  ProviderIds?: {
    Imdb?: string
    Tmdb?: string
    Tvdb?: string
    [key: string]: string | undefined
  }
  Tags?: string[]
  ProductionLocations?: string[]
  Awards?: string
  ParentId?: string
  ImageTags?: {
    Primary?: string
    Backdrop?: string
  }
  BackdropImageTags?: string[]
  UserData?: {
    PlayCount: number
    IsFavorite: boolean
    LastPlayedDate?: string
    Played: boolean
  }
  ChildCount?: number // Number of seasons
  RecursiveItemCount?: number // Total episodes
}

export interface EmbyEpisode {
  Id: string
  Name: string
  SeriesId: string
  SeriesName: string
  SeasonId?: string
  SeasonName?: string
  ParentIndexNumber: number // Season number
  IndexNumber: number // Episode number
  Overview?: string
  PremiereDate?: string
  ProductionYear?: number
  CommunityRating?: number
  RunTimeTicks?: number
  Path?: string
  MediaSources?: Array<{
    Id: string
    Path: string
    Container: string
    Size?: number
    Bitrate?: number
  }>
  People?: Array<{
    Name: string
    Id?: string
    Role?: string
    Type: string
    PrimaryImageTag?: string
  }>
  ProviderIds?: {
    Imdb?: string
    Tmdb?: string
    Tvdb?: string
    [key: string]: string | undefined
  }
  ImageTags?: {
    Primary?: string
  }
  UserData?: {
    PlayCount: number
    IsFavorite: boolean
    LastPlayedDate?: string
    PlaybackPositionTicks?: number
    Played: boolean
  }
}

