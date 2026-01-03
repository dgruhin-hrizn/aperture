/**
 * Jellyfin Mappers
 *
 * Convert Jellyfin API responses to internal types
 */

import type { Movie, Series, Episode } from '../types.js'
import type { JellyfinItem, JellyfinEpisode } from './types.js'

export function mapJellyfinItemToMovie(item: JellyfinItem, baseUrl: string): Movie {
  const directors =
    item.People?.filter((p) => p.Type === 'Director').map((p) => p.Name) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const actors =
    item.People?.filter((p) => p.Type === 'Actor')
      .slice(0, 20)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        thumb: p.PrimaryImageTag
          ? `${baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}`
          : undefined,
      })) || []

  return {
    id: item.Id,
    name: item.Name,
    originalTitle: item.OriginalTitle,
    sortName: item.SortName,
    year: item.ProductionYear,
    premiereDate: item.PremiereDate,
    genres: item.Genres || [],
    overview: item.Overview,
    tagline: item.Tagline,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    contentRating: item.OfficialRating,
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
    studios: item.Studios?.map((s) => s.Name) || [],
    directors,
    writers,
    actors,
    imdbId: item.ProviderIds?.Imdb,
    tmdbId: item.ProviderIds?.Tmdb,
    tags: item.Tags || [],
    productionCountries: item.ProductionLocations || [],
    awards: item.Awards,
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

export function mapJellyfinItemToSeries(item: JellyfinItem, baseUrl: string): Series {
  const directors =
    item.People?.filter((p) => p.Type === 'Director' || p.Type === 'Creator').map(
      (p) => p.Name
    ) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const actors =
    item.People?.filter((p) => p.Type === 'Actor')
      .slice(0, 20)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        thumb: p.PrimaryImageTag
          ? `${baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}`
          : undefined,
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
    studios: item.Studios?.map((s) => s.Name) || [],
    directors,
    writers,
    actors,
    imdbId: item.ProviderIds?.Imdb,
    tmdbId: item.ProviderIds?.Tmdb,
    tvdbId: item.ProviderIds?.Tvdb,
    tags: item.Tags || [],
    productionCountries: item.ProductionLocations || [],
    awards: item.Awards,
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

export function mapJellyfinItemToEpisode(item: JellyfinEpisode, baseUrl: string): Episode {
  const directors =
    item.People?.filter((p) => p.Type === 'Director').map((p) => p.Name) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const guestStars =
    item.People?.filter((p) => p.Type === 'GuestStar')
      .slice(0, 10)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        thumb: p.PrimaryImageTag
          ? `${baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}`
          : undefined,
      })) || []

  return {
    id: item.Id,
    seriesId: item.SeriesId,
    seriesName: item.SeriesName,
    seasonNumber: item.ParentIndexNumber || 0,
    episodeNumber: item.IndexNumber || 0,
    name: item.Name,
    overview: item.Overview,
    premiereDate: item.PremiereDate,
    year: item.ProductionYear,
    runtimeTicks: item.RunTimeTicks,
    communityRating: item.CommunityRating,
    posterImageTag: item.ImageTags?.Primary,
    path: item.Path,
    mediaSources: item.MediaSources?.map((ms) => ({
      id: ms.Id,
      path: ms.Path,
      container: ms.Container,
      size: ms.Size,
      bitrate: ms.Bitrate,
    })),
    directors,
    writers,
    guestStars,
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

