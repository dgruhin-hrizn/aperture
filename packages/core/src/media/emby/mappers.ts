import type { EmbyItem } from './types.js'
import type { Movie } from '../types.js'

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
        thumb: p.PrimaryImageTag
          ? `${baseUrl}/Items/${item.Id}/Images/Primary?tag=${p.PrimaryImageTag}`
          : undefined,
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
    // New metadata fields
    studios: item.Studios?.map((s) => s.Name) || [],
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

