/**
 * Shared Emby item mapping utilities used by movie/series/episode mappers.
 */

import type { EmbyItem, EmbyEpisode } from './types.js'
import type { WatchedItem, WatchedEpisode } from '../types.js'

type EmbyPerson = {
  Name: string
  Id?: string
  Role?: string
  Type: string
}

type EmbyUserData = {
  PlayCount: number
  IsFavorite: boolean
  LastPlayedDate?: string
  PlaybackPositionTicks?: number
  Played: boolean
}

type EmbyMediaSource = {
  Id: string
  Path: string
  Container: string
  Size?: number
  Bitrate?: number
  MediaStreams?: Array<{
    Type: string
    Codec?: string
    Width?: number
    Height?: number
  }>
}

export function personThumbUrl(baseUrl: string, name: string): string {
  return `${baseUrl}/Persons/${encodeURIComponent(name)}/Images/Primary`
}

export function extractPeopleNames(people: EmbyPerson[] | undefined, types: string[]): string[] {
  return people?.filter((p) => types.includes(p.Type)).map((p) => p.Name) || []
}

export function mapEmbyActors(people: EmbyPerson[] | undefined, baseUrl: string, limit = 20) {
  return (
    people
      ?.filter((p) => p.Type === 'Actor')
      .slice(0, limit)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        ...(p.Id ? { personId: String(p.Id) } : {}),
        thumb: p.Name ? personThumbUrl(baseUrl, p.Name) : undefined,
      })) || []
  )
}

export function mapEmbyGuestStars(people: EmbyPerson[] | undefined, baseUrl: string, limit = 10) {
  return (
    people
      ?.filter((p) => p.Type === 'GuestStar')
      .slice(0, limit)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        thumb: p.Name ? personThumbUrl(baseUrl, p.Name) : undefined,
      })) || []
  )
}

export function mapEmbyStudios(studios: Array<{ Name: string; Id?: number | string }> | undefined) {
  return (
    studios?.map((s) => ({
      id: s.Id?.toString(),
      name: s.Name,
    })) || []
  )
}

export function mapEmbyMediaSources(sources: EmbyMediaSource[] | undefined) {
  return sources?.map((ms) => ({
    id: ms.Id,
    path: ms.Path,
    container: ms.Container,
    size: ms.Size,
    bitrate: ms.Bitrate,
  }))
}

export function mapEmbyUserData(userData: EmbyUserData | undefined, includePosition = false) {
  if (!userData) {
    return undefined
  }

  return {
    playCount: userData.PlayCount,
    isFavorite: userData.IsFavorite,
    lastPlayedDate: userData.LastPlayedDate,
    ...(includePosition ? { playbackPositionTicks: userData.PlaybackPositionTicks } : {}),
    played: userData.Played,
  }
}

export function mapEmbyVideoQuality(primarySource: EmbyMediaSource | undefined) {
  const videoStream = primarySource?.MediaStreams?.find((s) => s.Type === 'Video')
  const audioStream = primarySource?.MediaStreams?.find((s) => s.Type === 'Audio')

  return {
    videoResolution:
      videoStream?.Width && videoStream?.Height
        ? `${videoStream.Width}x${videoStream.Height}`
        : undefined,
    videoCodec: videoStream?.Codec,
    audioCodec: audioStream?.Codec,
    container: primarySource?.Container,
  }
}

export function mapEmbyItemToWatchedMovie(item: EmbyItem): WatchedItem {
  return {
    movieId: item.Id,
    playCount: item.UserData?.PlayCount || 0,
    isFavorite: item.UserData?.IsFavorite || false,
    lastPlayedDate: item.UserData?.LastPlayedDate,
    tmdbId: item.ProviderIds?.Tmdb,
    imdbId: item.ProviderIds?.Imdb,
    played: item.UserData?.Played ?? false,
    playbackPositionTicks: item.UserData?.PlaybackPositionTicks,
    runtimeTicks: item.RunTimeTicks,
  }
}

export function mapEmbyEpisodeToWatched(item: EmbyEpisode): WatchedEpisode {
  return {
    episodeId: item.Id,
    seriesId: item.SeriesId,
    seasonNumber: item.ParentIndexNumber,
    episodeNumber: item.IndexNumber,
    playCount: item.UserData?.PlayCount || 0,
    isFavorite: item.UserData?.IsFavorite || false,
    lastPlayedDate: item.UserData?.LastPlayedDate,
    tmdbId: item.ProviderIds?.Tmdb,
    imdbId: item.ProviderIds?.Imdb,
    tvdbId: item.ProviderIds?.Tvdb,
    played: item.UserData?.Played ?? false,
    playbackPositionTicks: item.UserData?.PlaybackPositionTicks,
    runtimeTicks: item.RunTimeTicks,
  }
}

export function seriesEndYear(endDate: string | undefined): number | undefined {
  if (!endDate) {
    return undefined
  }
  return new Date(endDate).getFullYear()
}
