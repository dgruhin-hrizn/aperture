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
}

export interface EmbyLibrary {
  Id?: string
  ItemId?: string
  Guid?: string
  Name: string
  CollectionType: string
  Path?: string
  RefreshStatus?: string
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
  Studios?: Array<{ Name: string }>
  People?: Array<{
    Name: string
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

