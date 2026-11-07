import { tmdbRequest, getImageUrl } from '../tmdb/client.js'
import { searchPersonByName, getPersonCombinedCredits } from '../tmdb/person.js'
import { query } from '../lib/db.js'
import { getTMDbApiKey } from '../settings/systemSettings.js'
import { getCatalogScopeForItems } from './access.js'
import { encoreCatalogScope, query as scopedQuery } from './scopedDb.js'
import type { ContentItem } from './schemas/contentItem.js'
import { contentOverviewExcerpt } from './tools/shared/search.js'

interface ExternalTitle {
  id: number
  title?: string
  name?: string
  media_type?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  vote_average?: number
  adult?: boolean
}
export async function discoverEncoreTitles(
  userId: string,
  input: {
    query?: string
    type: 'movie' | 'tv'
    region: string
    genreId?: number
    year?: number
    limit: number
  }
) {
  if (!(await getTMDbApiKey()))
    throw new Error('Configure TMDb to discover titles beyond your library')
  const params = new URLSearchParams({
    include_adult: 'false',
    region: input.region,
    sort_by: 'popularity.desc',
  })
  if (input.query) params.set('query', input.query)
  if (input.genreId) params.set('with_genres', String(input.genreId))
  if (input.year)
    params.set(
      input.type === 'movie' ? 'primary_release_year' : 'first_air_date_year',
      String(input.year)
    )
  const result = await tmdbRequest<{ results: ExternalTitle[] }>(
    `/${input.query ? 'search' : 'discover'}/${input.type}?${params}`,
    { timeoutMs: 8000, maxRetries: 1 }
  )
  if (!result) throw new Error('TMDb discovery is temporarily unavailable')
  const ids = result.results.filter((r) => !r.adult).slice(0, input.limit).map((r) => String(r.id))
  const isMovie = input.type === 'movie'
  const table = isMovie ? 'movies' : 'series'
  const candidates = await query<{ provider_item_id: string }>(
    `SELECT provider_item_id FROM ${table} WHERE tmdb_id = ANY($1::text[]) AND provider_item_id IS NOT NULL`,
    [ids]
  )
  const providerIds = candidates.rows.map((row) => row.provider_item_id)
  const scope = await getCatalogScopeForItems(userId, {
    movieIds: isMovie ? providerIds : [], seriesIds: isMovie ? [] : providerIds,
  }).catch(() => null)
  // Public discovery can continue during a media server outage.
  const local = scope ? await encoreCatalogScope.run(scope, () =>
    scopedQuery<{ id: string; tmdb_id: string }>(
      `SELECT id, tmdb_id FROM ${table} WHERE tmdb_id = ANY($1::text[]) ORDER BY id`, [ids]
    )
  ) : { rows: [] }
  const today = new Date().toISOString().slice(0, 10)
  const items: ContentItem[] = result.results
    .filter((r) => !r.adult)
    .slice(0, input.limit)
    .map((r) => {
      const owned = local.rows.find((l) => l.tmdb_id === String(r.id))
      const date = r.release_date ?? r.first_air_date
      const type = input.type === 'movie' ? 'movie' : 'series'
      return {
        id: owned?.id ?? `tmdb:${input.type}:${r.id}`,
        type,
        name: r.title ?? r.name ?? '',
        subtitle: date?.slice(0, 4),
        overview: contentOverviewExcerpt(r.overview),
        image: getImageUrl(r.poster_path ?? null, 'w342'),
        rating: r.vote_average,
        availability: owned ? 'library' : date && date > today ? 'upcoming' : 'external',
        sourceUrl: `https://www.themoviedb.org/${input.type}/${r.id}`,
        source: 'TMDb',
        actions: [
          {
            id: 'details',
            label: 'Details',
            href: owned
              ? `/${type === 'movie' ? 'movies' : 'series'}/${owned.id}`
              : `https://www.themoviedb.org/${input.type}/${r.id}`,
          },
        ],
      }
    })
  return {
    id: `discovery-${Date.now()}`,
    kind: 'discovery',
    source: 'TMDb',
    retrievedAt: new Date().toISOString(),
    region: input.region,
    items,
  }
}

export async function getEncoreFilmography(name: string) {
  if (!(await getTMDbApiKey())) throw new Error('Configure TMDb to look up external credits')
  const person = await searchPersonByName(name)
  if (!person)
    return {
      people: [],
      source: 'TMDb',
      warnings: ['No verified person match was returned; the upstream search may be unavailable'],
    }
  const credits = await getPersonCombinedCredits(person.id)
  if (!credits) throw new Error('TMDb credits are temporarily unavailable')
  const seen = new Set<string>()
  const filmography = [...(credits.cast ?? []), ...(credits.crew ?? [])]
    .filter((r) => {
      const key = `${r.media_type}:${r.id}`
      if (r.adult || seen.has(key) || !['movie', 'tv'].includes(r.media_type ?? '')) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      (b.release_date ?? b.first_air_date ?? '').localeCompare(
        a.release_date ?? a.first_air_date ?? ''
      )
    )
    .slice(0, 50)
    .map((r) => ({
      id: `tmdb:${r.media_type}:${r.id}`,
      type: r.media_type === 'movie' ? 'movie' : 'series',
      title: r.title ?? r.name ?? '',
      year: Number((r.release_date ?? r.first_air_date ?? '').slice(0, 4)) || null,
      role: r.character ?? r.job,
      sourceUrl: `https://www.themoviedb.org/${r.media_type}/${r.id}`,
    }))
  return {
    totalCredits: seen.size,
    truncated: seen.size > filmography.length,
    people: [
      {
        name: person.name,
        role: credits.crew?.some((r) => r.job === 'Director') ? 'director' : 'actor',
        thumb: getImageUrl(person.profile_path, 'w185'),
        filmography,
      },
    ],
    source: 'TMDb',
    retrievedAt: new Date().toISOString(),
  }
}
