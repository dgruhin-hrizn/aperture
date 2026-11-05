import { tmdbRequest, getImageUrl } from '../tmdb/client.js'
interface TmdbDetails { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; overview?: string; tagline?: string; genres?: Array<{ name: string }>; poster_path?: string; runtime?: number; episode_run_time?: number[]; number_of_seasons?: number; number_of_episodes?: number; vote_average?: number; status?: string; networks?: Array<{ name: string }> }
interface Provider { provider_name: string }
export async function getExternalTitleDetails(type: 'movie' | 'tv', id: number, region: string) {
  const [details, credits, providers] = await Promise.all([
    tmdbRequest<TmdbDetails>(`/${type}/${id}`, { timeoutMs: 8000, maxRetries: 1 }),
    tmdbRequest<{ cast: Array<{ name: string }>; crew: Array<{ name: string; job: string }> }>(`/${type}/${id}/credits`, { timeoutMs: 8000, maxRetries: 1 }),
    tmdbRequest<{ results: Record<string, { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[] }> }>(`/${type}/${id}/watch/providers`, { timeoutMs: 8000, maxRetries: 1 }),
  ])
  if (!details) throw new Error('TMDb title details are unavailable')
  const available = providers?.results[region]
  return { id: `tmdb:${type}:${id}`, kind: 'externalDetails', contentId: `tmdb:${type}:${id}`, type: type === 'movie' ? 'movie' : 'series',
    name: details.title ?? details.name ?? '', year: Number((details.release_date ?? details.first_air_date ?? '').slice(0, 4)) || null,
    overview: details.overview, tagline: details.tagline, genres: details.genres?.map((g) => g.name), image: getImageUrl(details.poster_path ?? null, 'w342'),
    runtime: details.runtime ? `${details.runtime} min` : details.episode_run_time?.[0] ? `${details.episode_run_time[0]} min / episode` : null,
    communityRating: details.vote_average, director: credits?.crew.find((c) => c.job === 'Director')?.name,
    cast: credits?.cast.slice(0, 10).map((c) => c.name), network: details.networks?.map((n) => n.name).join(', '),
    status: details.status, seasonCount: details.number_of_seasons, episodeCount: details.number_of_episodes,
    availability: 'unknown', region, source: 'TMDb', retrievedAt: new Date().toISOString(),
    watchProviders: available ? { subscription: available.flatrate?.map((p) => p.provider_name) ?? [], rent: available.rent?.map((p) => p.provider_name) ?? [], buy: available.buy?.map((p) => p.provider_name) ?? [], link: available.link } : null,
    warnings: providers ? [] : ['Streaming availability could not be refreshed'],
    actions: [{ id: 'details', label: 'TMDb', href: `https://www.themoviedb.org/${type}/${id}` }],
  }
}
