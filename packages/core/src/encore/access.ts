import { queryOne } from '../lib/db.js'
import { getMediaServerConfig } from '../settings/systemSettings.js'
import { encoreCatalogScope, type CatalogScope } from './scopedDb.js'

export interface EncoreAccount {
  id: string
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  provider_access_token: string
  is_enabled: boolean
  provider_disabled: boolean
}
export async function getEncoreAccount(userId: string): Promise<EncoreAccount> {
  const account = await queryOne<EncoreAccount>(
    'SELECT id, provider, provider_user_id, provider_access_token, is_enabled, provider_disabled FROM users WHERE id = $1',
    [userId]
  )
  if (!account?.is_enabled || account.provider_disabled)
    throw new Error('This Aperture account is disabled')
  if (!account.provider_access_token)
    throw new Error('Sign into Aperture with your media server before accessing your collection')
  return account
}
export async function mediaRequest<T>(
  account: EncoreAccount,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return requestMediaServer(account, await getMediaServerConfig(), path, options)
}

async function requestMediaServer<T>(
  account: EncoreAccount,
  config: Awaited<ReturnType<typeof getMediaServerConfig>>,
  path: string,
  options: RequestInit
): Promise<T> {
  if (!config.baseUrl || config.type !== account.provider)
    throw new Error('The media server is unavailable')
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'X-Emby-Token': account.provider_access_token,
    },
  })
  if (!response.ok) throw new Error(`Media server request failed (${response.status})`)
  const text = await response.text()
  return !text ? (undefined as T) : (JSON.parse(text) as T)
}

interface CatalogPage {
  Items: Array<{ Id: string; Type: string }>
  TotalRecordCount?: number
}

async function readCatalogScope(userId: string, signal?: AbortSignal, requested?: CatalogScope): Promise<CatalogScope> {
  const [account, config] = await Promise.all([getEncoreAccount(userId), getMediaServerConfig()])
  const timeout = AbortSignal.timeout(30_000)
  const deadline = signal ? AbortSignal.any([signal, timeout]) : timeout
  const scope: CatalogScope = { movieIds: [], seriesIds: [] }
  const requestedIds = requested && [...new Set([...requested.movieIds, ...requested.seriesIds])]
  const pageSize = requestedIds ? 50 : 1000
  let offset = 0

  while (offset < (requestedIds?.length ?? 200_000)) {
    deadline.throwIfAborted()
    const ids = requestedIds && new Set(requestedIds.slice(offset, offset + pageSize))
    const params = new URLSearchParams({
      Recursive: 'true',
      IncludeItemTypes: 'Movie,Series',
      EnableImages: 'false',
      EnableUserData: 'false',
      Limit: String(ids?.size ?? pageSize),
      SortBy: 'SortName',
    })
    if (ids) params.set('Ids', [...ids].join(','))
    else params.set('StartIndex', String(offset))

    // ParentId can bypass Emby's library filtering. Always use the unparented user view.
    const page = await requestMediaServer<CatalogPage>(
      account, config, `/Users/${encodeURIComponent(account.provider_user_id)}/Items?${params}`,
      { signal: deadline }
    )
    if (!Array.isArray(page?.Items))
      throw new Error('The media server did not return an explicit accessible catalog')
    for (const item of page.Items) {
      if (!item.Id || (ids && !ids.has(item.Id))) continue
      if (item.Type === 'Movie') scope.movieIds.push(item.Id)
      if (item.Type === 'Series') scope.seriesIds.push(item.Id)
    }
    if (ids) {
      offset += ids.size
    } else {
      offset += page.Items.length
      if (page.Items.length === 0 || (page.TotalRecordCount !== undefined
        ? offset >= page.TotalRecordCount
        : page.Items.length < pageSize)) return scope
    }
  }
  if (requestedIds) return scope
  throw new Error('The accessible catalog exceeds the supported request bound')
}

const catalogReads = new Map<string, Promise<CatalogScope>>()

/** Share concurrent reads for an account. A new request after completion rechecks live access. */
export function getCatalogScope(userId: string, signal?: AbortSignal): Promise<CatalogScope> {
  if (signal) return readCatalogScope(userId, signal)
  const existing = catalogReads.get(userId)
  if (existing) return existing
  const pending = readCatalogScope(userId).finally(() => catalogReads.delete(userId))
  catalogReads.set(userId, pending)
  return pending
}

export function getCatalogScopeForItems(userId: string, requested: CatalogScope, signal?: AbortSignal) {
  return readCatalogScope(userId, signal, requested)
}

export async function withViewerCatalog<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const scope = await getCatalogScope(userId).catch((cause: unknown) => {
    throw Object.assign(new Error('The media library is temporarily unavailable', { cause }), { statusCode: 503 })
  })
  return encoreCatalogScope.run(scope, action)
}
