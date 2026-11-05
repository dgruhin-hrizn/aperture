import { getTMDbApiKey } from '../settings/systemSettings.js'
import { query } from '../lib/db.js'
import { AsyncCache, concurrencyLimit } from '../lib/asyncCache.js'
import { getUpcomingEpisodeBatch } from '../watching/upcomingEpisodes.js'
import { tmdbRequest } from '../tmdb/client.js'
import { getCatalogScope } from './access.js'

export interface ReleaseEvent {
  id: string
  title: string
  date: string
  precision: 'day'
  mediaType: 'movie' | 'series'
  source: 'TMDb' | 'Emby' | 'TVmaze'
  sourceUrl: string
  releaseType: string
  region: string
  season?: number
  episode?: number
  episodeTitle?: string
  seriesId?: string
  availability: 'unknown'
}
export interface ReleaseQuery {
  mode: 'following' | 'tvCalendar' | 'movies'
  startDate: string
  endDate: string
  region: string
  limit: number
}
type ReleaseRequest = Omit<ReleaseQuery, 'startDate' | 'endDate'> & {
  startDate?: string
  endDate?: string
  daysAhead?: number
}
const DAY_MS = 86400_000
const forecasts = new AsyncCache<ReleaseEvent[]>(30 * 60_000, 300)
const remoteLimit = concurrencyLimit(4)
export function validateReleaseWindow(start: string, end: string) {
  const first = new Date(`${start}T00:00:00Z`),
    last = new Date(`${end}T00:00:00Z`)
  if (
    !Number.isFinite(+first) ||
    !Number.isFinite(+last) ||
    first.toISOString().slice(0, 10) !== start ||
    last.toISOString().slice(0, 10) !== end ||
    +last < +first ||
    +last - +first > 31 * DAY_MS
  )
    throw new Error('Release windows must be valid dates within 31 days')
}

export function releaseLocalDate(timezone = 'UTC', now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function resolveReleaseWindow(request: ReleaseRequest, today: string) {
  const startDate = request.startDate ?? today
  validateReleaseWindow(startDate, startDate)
  const endAfter = (days: number) =>
    new Date(Date.parse(startDate) + days * DAY_MS).toISOString().slice(0, 10)
  const requestedEnd =
    request.endDate ?? endAfter(request.daysAhead ?? (request.mode === 'tvCalendar' ? 6 : 14))
  validateReleaseWindow(startDate, requestedEnd)
  const endDate =
    request.mode === 'tvCalendar' && requestedEnd > endAfter(6) ? endAfter(6) : requestedEnd
  return { startDate, endDate, limited: endDate !== requestedEnd }
}
interface MazeEpisode {
  id: number
  name: string
  airdate: string
  season: number
  number: number
  url: string
  show: { name: string; url: string }
}
async function mazeDay(date: string, region: string): Promise<ReleaseEvent[]> {
  return forecasts.get(`${date}:${region}`, () =>
    remoteLimit(async () => {
      const data = await Promise.all(
        [`schedule?country=${region}&date=${date}`, `schedule/web?country=&date=${date}`].map(
          async (path) => {
            const response = await fetch(`https://api.tvmaze.com/${path}`, {
              signal: AbortSignal.timeout(8000),
            })
            if (!response.ok) throw new Error(`TVmaze schedule is unavailable (${response.status})`)
            const result: unknown = await response.json()
            if (!Array.isArray(result)) throw new Error('TVmaze returned an invalid schedule')
            return result as MazeEpisode[]
          }
        )
      )
      return data.flat().map((r) => ({
        id: `tvmaze:${r.id}`,
        title: r.show.name,
        date: r.airdate,
        precision: 'day',
        mediaType: 'series',
        source: 'TVmaze',
        sourceUrl: r.url ?? r.show.url,
        releaseType: 'episode',
        region,
        season: r.season,
        episode: r.number,
        episodeTitle: r.name,
        availability: 'unknown',
      }))
    })
  )
}

export async function getEncoreReleases(
  userId: string,
  request: ReleaseRequest,
  timezone?: string
) {
  const { startDate, endDate, limited } = resolveReleaseWindow(request, releaseLocalDate(timezone))
  const input = { ...request, startDate, endDate }
  const events: ReleaseEvent[] = [],
    warnings: string[] = limited
      ? ['The regional TV calendar covers the first seven days of this window.']
      : []
  if (input.mode === 'following') {
    if (!(await getTMDbApiKey()))
      warnings.push('TMDb is not configured; only locally synced episode forecasts were checked')
    const scope = await getCatalogScope(userId)
    const { rows } = await query<{ id: string; title: string }>(
      `SELECT s.id, s.title FROM user_watching_series w JOIN series s ON s.id = w.series_id
      WHERE w.user_id = $1 AND s.provider_item_id = ANY($2::text[]) ORDER BY s.title LIMIT 300`,
      [userId, scope.seriesIds]
    )
    const batch = await getUpcomingEpisodeBatch(rows.map((r) => r.id))
    if (batch.resolvedSeriesIds.length < rows.length)
      warnings.push('Some episode forecasts could not be refreshed')
    for (const row of rows) {
      const e = batch.episodes.get(row.id)
      if (e)
        events.push({
          id: `${row.id}:${e.seasonNumber}:${e.episodeNumber}`,
          title: row.title,
          seriesId: row.id,
          date: e.airDate,
          precision: 'day',
          mediaType: 'series',
          source: e.source === 'tmdb' ? 'TMDb' : 'Emby',
          sourceUrl: `/series/${row.id}`,
          releaseType: 'next episode',
          region: input.region,
          season: e.seasonNumber,
          episode: e.episodeNumber,
          episodeTitle: e.title,
          availability: 'unknown',
        })
    }
  } else if (input.mode === 'tvCalendar') {
    const dates: string[] = []
    for (let at = Date.parse(input.startDate); at <= Date.parse(input.endDate); at += DAY_MS)
      dates.push(new Date(at).toISOString().slice(0, 10))
    const batches = await Promise.allSettled(dates.map((date) => mazeDay(date, input.region)))
    for (const batch of batches)
      if (batch.status === 'fulfilled') events.push(...batch.value)
      else warnings.push('A TVmaze schedule could not be refreshed')
  } else {
    const params = new URLSearchParams({
      region: input.region,
      'release_date.gte': input.startDate,
      'release_date.lte': input.endDate,
      with_release_type: '3|4',
      include_adult: 'false',
      sort_by: 'popularity.desc',
    })
    const titles = await tmdbRequest<{ results: Array<{ id: number; title: string }> }>(
      `/discover/movie?${params}`,
      { timeoutMs: 8000, maxRetries: 1 }
    )
    if (!titles)
      throw new Error('TMDb movie releases are unavailable. Verify your TMDb configuration')
    const batches = await Promise.allSettled(
      titles.results.slice(0, Math.min(input.limit, 15)).map((movie) =>
        remoteLimit(async () => {
          const dates = await tmdbRequest<{
            results: Array<{
              iso_3166_1: string
              release_dates: Array<{ release_date: string; type: number }>
            }>
          }>(`/movie/${movie.id}/release_dates`, { timeoutMs: 8000, maxRetries: 1 })
          if (!dates) throw new Error('Movie release dates could not be refreshed')
          return (dates.results.find((r) => r.iso_3166_1 === input.region)?.release_dates ?? [])
            .filter((d) => [3, 4].includes(d.type))
            .map(
              (d): ReleaseEvent => ({
                id: `tmdb:movie:${movie.id}:${d.type}:${d.release_date.slice(0, 10)}`,
                title: movie.title,
                date: d.release_date.slice(0, 10),
                precision: 'day',
                mediaType: 'movie',
                source: 'TMDb',
                sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`,
                releaseType: d.type === 4 ? 'digital' : 'theatrical',
                region: input.region,
                availability: 'unknown',
              })
            )
        })
      )
    )
    for (const batch of batches)
      if (batch.status === 'fulfilled') events.push(...batch.value)
      else warnings.push('Some movie release dates could not be refreshed')
  }
  const seen = new Set<string>()
  return {
    kind: 'releases' as const,
    retrievedAt: new Date().toISOString(),
    region: input.region,
    mode: input.mode,
    startDate,
    endDate,
    warnings: [...new Set(warnings)],
    events: events
      .filter((e) => {
        if (seen.has(e.id) || e.date < input.startDate || e.date > input.endDate) return false
        seen.add(e.id)
        return true
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
      .slice(0, input.limit),
  }
}
