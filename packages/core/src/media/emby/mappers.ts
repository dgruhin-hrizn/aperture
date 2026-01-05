import type { EmbyItem, EmbySeries, EmbyEpisode } from './types.js'
import type { Movie, Series, Episode } from '../types.js'

/**
 * Map an Emby item to the internal Movie type
 */
export function mapEmbyItemToMovie(item: EmbyItem, baseUrl: string): Movie {
  // Extract people by type
  const directors = item.People?.filter((p) => p.Type === 'Director').map((p) => p.Name) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const actors =
    item.People?.filter((p) => p.Type === 'Actor')
      .slice(0, 20)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        // Use Persons endpoint for actor images
        thumb: p.Name ? `${baseUrl}/Persons/${encodeURIComponent(p.Name)}/Images/Primary` : undefined,
      })) || []

  // Extract video/audio info from first media source
  const primarySource = item.MediaSources?.[0]
  const videoStream = primarySource?.MediaStreams?.find((s) => s.Type === 'Video')
  const audioStream = primarySource?.MediaStreams?.find((s) => s.Type === 'Audio')

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
    // New metadata fields - include studio IDs for image lookups
    studios: item.Studios?.map((s) => ({
      id: s.Id?.toString(),
      name: s.Name,
    })) || [],
    directors,
    writers,
    actors,
    imdbId: item.ProviderIds?.Imdb,
    tmdbId: item.ProviderIds?.Tmdb,
    tags: item.Tags || [],
    productionCountries: item.ProductionLocations || [],
    awards: item.Awards,
    // Video/audio quality
    videoResolution:
      videoStream?.Width && videoStream?.Height
        ? `${videoStream.Width}x${videoStream.Height}`
        : undefined,
    videoCodec: videoStream?.Codec,
    audioCodec: audioStream?.Codec,
    container: primarySource?.Container,
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

/**
 * Map an Emby series to the internal Series type
 */
export function mapEmbyItemToSeries(item: EmbySeries, baseUrl: string): Series {
  // Extract people by type
  const directors = item.People?.filter((p) => p.Type === 'Director' || p.Type === 'Creator').map((p) => p.Name) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const actors =
    item.People?.filter((p) => p.Type === 'Actor')
      .slice(0, 20)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        // Use Persons endpoint for actor images
        thumb: p.Name ? `${baseUrl}/Persons/${encodeURIComponent(p.Name)}/Images/Primary` : undefined,
      })) || []

  // Extract end year from EndDate if available
  let endYear: number | undefined
  if (item.EndDate) {
    endYear = new Date(item.EndDate).getFullYear()
  }

  return {
    id: item.Id,
    name: item.Name,
    originalTitle: item.OriginalTitle,
    sortName: item.SortName,
    year: item.ProductionYear,
    endYear,
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
    studios: item.Studios?.map((s) => ({
      id: s.Id?.toString(),
      name: s.Name,
    })) || [],
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
          played: item.UserData.Played,
        }
      : undefined,
  }
}

/**
 * Map an Emby episode to the internal Episode type
 */
export function mapEmbyItemToEpisode(item: EmbyEpisode, baseUrl: string): Episode {
  // Extract people by type
  const directors = item.People?.filter((p) => p.Type === 'Director').map((p) => p.Name) || []
  const writers = item.People?.filter((p) => p.Type === 'Writer').map((p) => p.Name) || []
  const guestStars =
    item.People?.filter((p) => p.Type === 'GuestStar')
      .slice(0, 10)
      .map((p) => ({
        name: p.Name,
        role: p.Role,
        // Use Persons endpoint for person images
        thumb: p.Name ? `${baseUrl}/Persons/${encodeURIComponent(p.Name)}/Images/Primary` : undefined,
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

