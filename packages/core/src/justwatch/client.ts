import { createChildLogger } from '../lib/logger.js'
import { POPULAR_TITLES_QUERY, SEARCH_TITLES_QUERY, PROVIDERS_QUERY } from './graphqlQueries.js'

const logger = createChildLogger('justwatch-client')

const DEFAULT_URL = 'https://apis.justwatch.com/graphql'
const DEFAULT_UA =
  process.env.JUSTWATCH_USER_AGENT ||
  'Mozilla/5.0 (compatible; Aperture/1.0; +https://github.com/aperture)'

export interface JustWatchFetchOptions {
  timeoutMs?: number
}

async function postGraphql(body: Record<string, unknown>, options?: JustWatchFetchOptions): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? 25_000
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(DEFAULT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': DEFAULT_UA,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`JustWatch non-JSON response (${res.status}): ${text.slice(0, 200)}`)
    }
    if (!res.ok) {
      throw new Error(`JustWatch HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const gql = json as { errors?: Array<{ message?: string }> }
    if (gql.errors?.length) {
      throw new Error(gql.errors.map((e) => e.message || 'GraphQL error').join('; '))
    }
    return json
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('JustWatch request timed out')
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}

export async function fetchPopularTitles(
  params: {
    country: string
    language: string
    first: number
    offset?: number
    packages?: string[] | null
    bestOnly?: boolean
  },
  options?: JustWatchFetchOptions
): Promise<unknown> {
  const {
    country,
    language,
    first,
    offset = 0,
    packages = null,
    bestOnly = true,
  } = params

  const body = {
    operationName: 'GetPopularTitles',
    variables: {
      first,
      popularTitlesFilter: { packages },
      language,
      country: country.toUpperCase(),
      formatPoster: 'JPG',
      formatOfferIcon: 'PNG',
      profile: 'S718',
      backdropProfile: 'S1920',
      filter: { bestOnly },
      offset: offset > 0 ? offset : null,
    },
    query: POPULAR_TITLES_QUERY,
  }

  logger.debug({ country, first, offset }, 'JustWatch GetPopularTitles')
  return postGraphql(body, options)
}

export async function fetchSearchTitles(
  params: {
    country: string
    language: string
    query: string
    first: number
    offset?: number
    packages?: string[] | null
    bestOnly?: boolean
  },
  options?: JustWatchFetchOptions
): Promise<unknown> {
  const {
    country,
    language,
    query: searchQuery,
    first,
    offset = 0,
    packages = null,
    bestOnly = true,
  } = params

  const body = {
    operationName: 'GetSearchTitles',
    variables: {
      first,
      searchTitlesFilter: { searchQuery, packages },
      language,
      country: country.toUpperCase(),
      formatPoster: 'JPG',
      formatOfferIcon: 'PNG',
      profile: 'S718',
      backdropProfile: 'S1920',
      filter: { bestOnly },
      offset: offset > 0 ? offset : null,
    },
    query: SEARCH_TITLES_QUERY,
  }

  logger.debug({ country, first, q: searchQuery }, 'JustWatch GetSearchTitles')
  return postGraphql(body, options)
}

export async function fetchProviders(
  params: { country: string },
  options?: JustWatchFetchOptions
): Promise<unknown> {
  const body = {
    operationName: 'GetProviders',
    variables: {
      country: params.country.toUpperCase(),
      formatOfferIcon: 'PNG',
    },
    query: PROVIDERS_QUERY,
  }
  return postGraphql(body, options)
}
