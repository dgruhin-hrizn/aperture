/**
 * Jellyfin API Types
 */

export interface JellyfinAuthResponse {
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

export interface JellyfinUser {
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

export interface JellyfinLibrary {
  Id: string
  Guid?: string
  Name: string
  CollectionType: string
  Path?: string
  RefreshStatus?: string
}

export interface JellyfinItem {
  Id: string
  Name: string
  OriginalTitle?: string
  SortName?: string
  ProductionYear?: number
  PremiereDate?: string
  EndDate?: string
  Genres?: string[]
  Overview?: string
  Tagline?: string
  CommunityRating?: number
  CriticRating?: number
  OfficialRating?: string
  RunTimeTicks?: number
  Path?: string
  ParentId?: string
  Status?: string
  ChildCount?: number
  RecursiveItemCount?: number
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

export interface JellyfinSeries extends JellyfinItem {
  SeriesId?: string
}

export interface JellyfinEpisode extends JellyfinItem {
  SeriesId: string
  SeriesName: string
  ParentIndexNumber?: number // Season number
  IndexNumber?: number // Episode number
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[]
  TotalRecordCount: number
  StartIndex: number
}

export interface JellyfinSystemInfo {
  Id: string
  ServerName: string
  Version: string
}

