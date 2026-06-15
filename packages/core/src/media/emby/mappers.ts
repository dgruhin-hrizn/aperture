import type { EmbyItem, EmbySeries, EmbyEpisode } from './types.js'
import type { Movie, Series, Episode } from '../types.js'
import {
  extractPeopleNames,
  mapEmbyActors,
  mapEmbyGuestStars,
  mapEmbyMediaSources,
  mapEmbyStudios,
  mapEmbyUserData,
  mapEmbyVideoQuality,
  seriesEndYear,
} from './mapperHelpers.js'

export { mapEmbyEpisodeToWatched, mapEmbyItemToWatchedMovie } from './mapperHelpers.js'

export function mapEmbyItemToMovie(item: EmbyItem, baseUrl: string): Movie {
  const directors = extractPeopleNames(item.People, ['Director'])
  const writers = extractPeopleNames(item.People, ['Writer'])
  const actors = mapEmbyActors(item.People, baseUrl)
  const primarySource = item.MediaSources?.[0]
  const quality = mapEmbyVideoQuality(primarySource)

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
    mediaSources: mapEmbyMediaSources(item.MediaSources),
    posterImageTag: item.ImageTags?.Primary,
    backdropImageTag: item.BackdropImageTags?.[0] || item.ImageTags?.Backdrop,
    parentId: item.ParentId,
    studios: mapEmbyStudios(item.Studios),
    directors,
    writers,
    actors,
    imdbId: item.ProviderIds?.Imdb,
    tmdbId: item.ProviderIds?.Tmdb,
    tags: item.Tags || [],
    productionCountries: item.ProductionLocations || [],
    awards: item.Awards,
    ...quality,
    userData: mapEmbyUserData(item.UserData, true),
  }
}

export function mapEmbyItemToSeries(item: EmbySeries, baseUrl: string): Series {
  const directors = extractPeopleNames(item.People, ['Director', 'Creator'])
  const writers = extractPeopleNames(item.People, ['Writer'])
  const actors = mapEmbyActors(item.People, baseUrl)

  return {
    id: item.Id,
    name: item.Name,
    originalTitle: item.OriginalTitle,
    sortName: item.SortName,
    year: item.ProductionYear,
    endYear: seriesEndYear(item.EndDate),
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
    studios: mapEmbyStudios(item.Studios),
    directors,
    writers,
    actors,
    imdbId: item.ProviderIds?.Imdb,
    tmdbId: item.ProviderIds?.Tmdb,
    tvdbId: item.ProviderIds?.Tvdb,
    tags: item.Tags || [],
    productionCountries: item.ProductionLocations || [],
    awards: item.Awards,
    userData: mapEmbyUserData(item.UserData),
  }
}

export function mapEmbyItemToEpisode(item: EmbyEpisode, baseUrl: string): Episode {
  const directors = extractPeopleNames(item.People, ['Director'])
  const writers = extractPeopleNames(item.People, ['Writer'])
  const guestStars = mapEmbyGuestStars(item.People, baseUrl)

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
    mediaSources: mapEmbyMediaSources(item.MediaSources),
    directors,
    writers,
    guestStars,
    userData: mapEmbyUserData(item.UserData, true),
  }
}
